import 'server-only';

import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { serviceSubmissionsTable } from '@/db/schema';
import type { SubmissionEmailInput } from '@/lib/add-business/submission-email-format';
import type { SubmissionStatus } from '@/lib/submission-status';

/**
 * Zgloszenia z formularza „Dodaj firme" czekajace na reczna publikacje (`db:add`).
 * To poczekalnia, nie katalog: wiersz nie wplywa na mape ani wyniki, a zrodlem prawdy
 * opublikowanego wpisu zostaje plik w `data/services/`.
 *
 * Tylko `saveServiceSubmission` wola kod publiczny. Odczyty, zmiana statusu i usuwanie dotycza
 * danych osobowych zglaszajacego, wiec wolajacy w panelu MUSI najpierw sprawdzic
 * `hasDashboardAccess`.
 */

/**
 * Limit zapisu. Szkic jest juz zuzyty, wiec zawieszona baza nie moze zjesc budzetu funkcji:
 * po przekroczeniu `submitDraft` przechodzi na pelny mail do operatora.
 */
export const SUBMISSION_SAVE_TIMEOUT_MS = 5000;

const LIST_LIMIT = 200;

const idSchema = z.string().uuid();

export type SaveSubmissionResult = { ok: true; id: string } | { ok: false };

class SubmissionSaveTimeoutError extends Error {
    constructor() {
        super('Service submission save timed out');
        this.name = 'SubmissionSaveTimeoutError';
    }
}

async function withSaveTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
            () => reject(new SubmissionSaveTimeoutError()),
            SUBMISSION_SAVE_TIMEOUT_MS,
        );
    });
    return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

/** Nie rzuca: porazka to sygnal dla `submitDraft`, zeby wyslal pelny mail. */
export async function saveServiceSubmission(
    input: SubmissionEmailInput,
): Promise<SaveSubmissionResult> {
    const { entry, stored, submitterEmail, notes, logo, manualPin } = input;
    try {
        const [row] = await withSaveTimeout(
            db
                .insert(serviceSubmissionsTable)
                .values({
                    name: entry.json.name,
                    slug: entry.slug,
                    entry: entry.json,
                    unconfirmed: entry.unconfirmed,
                    changedByOwner: entry.changedByOwner,
                    missingCoordinates: entry.missingCoordinates,
                    manualPin,
                    submitterEmail,
                    notes,
                    locale: stored.locale,
                    source: stored.source,
                    sourceUrl: stored.sourceUrl,
                    logo,
                })
                .returning({ id: serviceSubmissionsTable.id }),
        );
        return { ok: true, id: row.id };
    } catch (error) {
        // Bez tresci zgloszenia i komunikatu bledu (drizzle dokleja do niego parametry
        // zapytania): dane zachowa kolejny krok, czyli pelny mail albo jego log.
        console.error('service submission not saved', {
            slug: entry.slug,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return { ok: false };
    }
}

/** Kolumny bez `logo`: bajty pliku czyta tylko `getServiceSubmissionLogo`. */
const submissionColumns = {
    id: serviceSubmissionsTable.id,
    status: serviceSubmissionsTable.status,
    name: serviceSubmissionsTable.name,
    slug: serviceSubmissionsTable.slug,
    entry: serviceSubmissionsTable.entry,
    unconfirmed: serviceSubmissionsTable.unconfirmed,
    changedByOwner: serviceSubmissionsTable.changedByOwner,
    missingCoordinates: serviceSubmissionsTable.missingCoordinates,
    manualPin: serviceSubmissionsTable.manualPin,
    submitterEmail: serviceSubmissionsTable.submitterEmail,
    notes: serviceSubmissionsTable.notes,
    locale: serviceSubmissionsTable.locale,
    source: serviceSubmissionsTable.source,
    sourceUrl: serviceSubmissionsTable.sourceUrl,
    createdAt: serviceSubmissionsTable.createdAt,
    hasLogo: sql<boolean>`${serviceSubmissionsTable.logo} is not null`,
};

export async function listServiceSubmissions() {
    return db
        .select(submissionColumns)
        .from(serviceSubmissionsTable)
        .orderBy(desc(serviceSubmissionsTable.createdAt))
        .limit(LIST_LIMIT);
}

export type ServiceSubmission = Awaited<ReturnType<typeof listServiceSubmissions>>[number];

/** `null` takze dla id spoza formatu UUID — Postgres odrzucilby je bledem, a to zwykle 404. */
export async function getServiceSubmission(id: string): Promise<ServiceSubmission | null> {
    if (!idSchema.safeParse(id).success) return null;
    const [row] = await db
        .select(submissionColumns)
        .from(serviceSubmissionsTable)
        .where(eq(serviceSubmissionsTable.id, id))
        .limit(1);
    return row ?? null;
}

export async function getServiceSubmissionLogo(
    id: string,
): Promise<{ slug: string; logo: Buffer } | null> {
    if (!idSchema.safeParse(id).success) return null;
    const [row] = await db
        .select({ slug: serviceSubmissionsTable.slug, logo: serviceSubmissionsTable.logo })
        .from(serviceSubmissionsTable)
        .where(eq(serviceSubmissionsTable.id, id))
        .limit(1);
    return row?.logo ? { slug: row.slug, logo: row.logo } : null;
}

/** `false` = nie ma takiego zgloszenia. */
export async function setServiceSubmissionStatus(
    id: string,
    status: SubmissionStatus,
): Promise<boolean> {
    const rows = await db
        .update(serviceSubmissionsTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(serviceSubmissionsTable.id, id))
        .returning({ id: serviceSubmissionsTable.id });
    return rows.length > 0;
}

/** Trwale, razem z logo i danymi zglaszajacego. `false` = nie ma takiego zgloszenia. */
export async function deleteServiceSubmission(id: string): Promise<boolean> {
    const rows = await db
        .delete(serviceSubmissionsTable)
        .where(eq(serviceSubmissionsTable.id, id))
        .returning({ id: serviceSubmissionsTable.id });
    return rows.length > 0;
}
