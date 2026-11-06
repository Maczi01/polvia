import 'server-only';

import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { and, eq, ne } from 'drizzle-orm';

import { formatZodIssue } from '@/db/format-zod-issue';
import {
    findServicesWithSameName,
    insertService,
    planServiceSlugs,
    type Transaction,
} from '@/db/insert-service';
import { serviceSubmissionsTable } from '@/db/schema';
import { embedServiceLocations } from '@/db/service-embedding';
import { serviceInputSchema } from '@/db/service-input-schema';
import { isValidServiceSlug } from '@/lib/service-slug-format';
import { getServiceSubmission, getServiceSubmissionLogo } from '@/lib/service-submissions';

/**
 * Publikacja zgloszenia z panelu: to samo co `db:add`, ale jednym przyciskiem. Dziala tylko
 * lokalnie, bo plik wpisu i logo musza trafic do repo (na Vercelu dysk jest efemeryczny).
 *
 * Kolejnosc: najpierw pliki (`wx`, nigdy nie nadpisuja), potem transakcja z wpisem i statusem.
 * Nieudana transakcja usuwa pliki, ktore ta publikacja utworzyla. Embedding jest ostatni
 * i jego blad nie cofa publikacji: `db:embeddings` dorobi go pozniej.
 */

export type PublishErrorCode =
    | 'NOT_FOUND'
    | 'ALREADY_PUBLISHED'
    | 'INVALID_ENTRY'
    | 'DUPLICATE_NAME'
    | 'SLUG_CONFLICT'
    | 'FILE_EXISTS'
    | 'SAVE_FAILED';

export type PublishedSubmission = {
    serviceSlug: string;
    /** Sciezki wzgledem repo do zacommitowania. */
    files: string[];
    isSearchIndexed: boolean;
};

export type PublishResult =
    | { ok: true; data: PublishedSubmission }
    | { ok: false; code: PublishErrorCode; message: string };

type EntryFile = { relativePath: string; content: string | Buffer };

class SubmissionAlreadyPublishedError extends Error {
    constructor() {
        super('Submission already published');
        this.name = 'SubmissionAlreadyPublishedError';
    }
}

const failure = (code: PublishErrorCode, message: string): PublishResult => ({
    ok: false,
    code,
    message,
});

const absolutePath = (rootDir: string, relativePath: string): string =>
    path.join(rootDir, ...relativePath.split('/'));

function hasErrorCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function removeFiles(rootDir: string, files: EntryFile[]): Promise<void> {
    await Promise.all(
        files.map(file => rm(absolutePath(rootDir, file.relativePath), { force: true })),
    );
}

/** Wszystko albo nic: przy bledzie usuwa pliki utworzone w tym wywolaniu. */
async function writeNewFiles(rootDir: string, files: EntryFile[]): Promise<void> {
    const written: EntryFile[] = [];
    try {
        for (const file of files) {
            await writeFile(absolutePath(rootDir, file.relativePath), file.content, { flag: 'wx' });
            written.push(file);
        }
    } catch (error) {
        await removeFiles(rootDir, written);
        throw error;
    }
}

/** Warunek na statusie chroni przed podwojna publikacja: rownolegla cofnie swoj wpis. */
async function markPublished(tx: Transaction, id: string): Promise<void> {
    const rows = await tx
        .update(serviceSubmissionsTable)
        .set({ status: 'added', updatedAt: new Date() })
        .where(and(eq(serviceSubmissionsTable.id, id), ne(serviceSubmissionsTable.status, 'added')))
        .returning({ id: serviceSubmissionsTable.id });
    if (rows.length === 0) throw new SubmissionAlreadyPublishedError();
}

async function indexForSearch(serviceId: string, slug: string): Promise<boolean> {
    try {
        await embedServiceLocations(serviceId);
        return true;
    } catch (error) {
        console.error('published service not indexed', {
            slug,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return false;
    }
}

export function isSubmissionPublishingEnabled(): boolean {
    return process.env.NODE_ENV === 'development';
}

export async function publishServiceSubmission(
    id: string,
    rootDir: string = process.cwd(),
): Promise<PublishResult> {
    const submission = await getServiceSubmission(id);
    if (!submission) return failure('NOT_FOUND', 'Submission not found');
    if (submission.status === 'added') {
        return failure('ALREADY_PUBLISHED', 'This submission has already been published.');
    }

    // Slug trafia do sciezki pliku, a wiersz pochodzi z publicznego formularza.
    const { slug } = submission;
    if (!isValidServiceSlug(slug)) {
        return failure('INVALID_ENTRY', 'The submission has an invalid slug.');
    }

    const logo = submission.hasLogo ? await getServiceSubmissionLogo(id) : null;
    const image = logo ? `${slug}.png` : undefined;
    // `undefined` znika z JSON-a, a wpis bez logo nie moze wskazywac pliku, ktorego nie ma.
    const entry = { ...submission.entry, image };

    const parsed = serviceInputSchema.safeParse(entry);
    if (!parsed.success) {
        const issues = parsed.error.issues.map(issue => formatZodIssue(issue)).join('; ');
        return failure(
            'INVALID_ENTRY',
            `Cannot publish: ${issues}. Download the JSON, fix it and add it with db:add.`,
        );
    }
    const input = parsed.data;

    const sameName = await findServicesWithSameName(input.name);
    if (sameName > 0) {
        return failure(
            'DUPLICATE_NAME',
            `The catalog already has an entry named "${input.name}". If it is not a duplicate, add it with db:add.`,
        );
    }

    const plan = await planServiceSlugs(input);
    if (!plan.ok) return failure('SLUG_CONFLICT', plan.message);

    const files: EntryFile[] = [
        {
            relativePath: `data/services/${slug}.json`,
            content: `${JSON.stringify(entry, null, 4)}\n`,
        },
        ...(logo ? [{ relativePath: `public/services/${slug}.png`, content: logo.logo }] : []),
    ];

    try {
        await writeNewFiles(rootDir, files);
    } catch (error) {
        if (hasErrorCode(error, 'EEXIST')) {
            return failure('FILE_EXISTS', `A file for "${slug}" already exists in the repository.`);
        }
        console.error('submission files not written', {
            slug,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return failure('SAVE_FAILED', 'Could not write the entry files. Nothing was published.');
    }

    let serviceId: string;
    try {
        serviceId = await insertService(input, plan.slugs, image ?? null, tx =>
            markPublished(tx, id),
        );
    } catch (error) {
        await removeFiles(rootDir, files);
        if (error instanceof SubmissionAlreadyPublishedError) {
            return failure('ALREADY_PUBLISHED', 'This submission has already been published.');
        }
        // Bez komunikatu bledu: drizzle dokleja do niego parametry zapytania.
        console.error('submission not published', {
            slug,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return failure('SAVE_FAILED', 'Could not save the entry. Nothing was published.');
    }

    return {
        ok: true,
        data: {
            serviceSlug: plan.slugs.serviceSlug,
            files: files.map(file => file.relativePath),
            isSearchIndexed: await indexForSearch(serviceId, slug),
        },
    };
}
