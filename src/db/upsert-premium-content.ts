import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { eq, inArray, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import {
    type PremiumContentData,
    premiumContentSchema,
    premiumImageFiles,
} from './premium-content-schema';
import { serviceLocationsTable, serviceProfilesTable, servicesTable } from './schema';
import { buildLocationSlugs, serviceInputSchema, type ServiceInput } from './service-input-schema';

/**
 * Publikacja tresci premium (`db:premium`, seed): upsert wiersza `service_profiles`
 * po slugu uslugi. Modul nie importuje `./index` (polaczenie z baza przy ladowaniu),
 * tylko dostaje magazyn — dzieki temu da sie go testowac bez bazy.
 */

export type PremiumContentErrorCode =
    | 'INVALID_ENTRY'
    | 'SERVICE_NOT_FOUND'
    | 'ENTRY_AMBIGUOUS'
    | 'IMAGES_MISSING';

export class PremiumContentError extends Error {
    readonly code: PremiumContentErrorCode;
    /** Dla `IMAGES_MISSING`: brakujace pliki, wzgledem `public/`. */
    readonly missingFiles: readonly string[];

    constructor(code: PremiumContentErrorCode, message: string, missingFiles: string[] = []) {
        super(message);
        this.name = 'PremiumContentError';
        this.code = code;
        this.missingFiles = missingFiles;
    }
}

/** Dostep do bazy potrzebny publikacji — produkcyjnie `createPremiumContentStore(db)`. */
export type PremiumContentStore = {
    findServiceIdBySlug(serviceSlug: string): Promise<string | null>;
    /** Slugi uslug, do ktorych naleza podane lokalizacje (bez powtorzen). */
    findServiceSlugsByLocationSlugs(locationSlugs: readonly string[]): Promise<string[]>;
    /** Surowy zapisany wiersz tresci albo `null`, gdy uslugi nie opublikowano. */
    findContent(serviceId: string): Promise<unknown>;
    saveContent(serviceId: string, content: PremiumContentData): Promise<void>;
};

/** Poprzednia tresc — do diffu w `--dry-run`. */
export type PreviousPremiumContent =
    | { kind: 'none' }
    | { kind: 'valid'; content: PremiumContentData }
    | { kind: 'invalid' };

export type PremiumUpsertPlan = { serviceId: string; previous: PreviousPremiumContent };

export type PremiumUpsertInput = {
    serviceSlug: string;
    content: PremiumContentData;
    /** Katalog `public/` (zdjecia leza w `<publicDir>/services/<serviceSlug>/`). */
    publicDir: string;
};

/** Pliki tresci, ktorych nie ma na dysku, jako `services/<slug>/<plik>` (wzgledem `public/`). */
export function findMissingPremiumImages(
    serviceSlug: string,
    content: PremiumContentData,
    publicDir: string,
): string[] {
    return premiumImageFiles(content)
        .map(file => path.posix.join('services', serviceSlug, file))
        .filter(relative => !existsSync(path.join(publicDir, relative)));
}

/**
 * Slug uslugi, ktora utworzyl plik wpisu. Szukany po slugach lokalizacji (jednoznaczne,
 * liczone z `slug` w JSON), a nie po `buildServiceSlug(name)`: przy duplikacie nazwy
 * wpis ma adres `nazwa-2`, a slug z nazwy wskazalby cudzy profil.
 */
export async function resolveEntryServiceSlug(
    store: PremiumContentStore,
    input: { slug: ServiceInput['slug']; locations: readonly { city: string }[] },
): Promise<string> {
    const locationSlugs = buildLocationSlugs(
        input.slug,
        input.locations.map(location => location.city),
    );
    const serviceSlugs = await store.findServiceSlugsByLocationSlugs(locationSlugs);

    if (serviceSlugs.length === 0) {
        throw new PremiumContentError(
            'SERVICE_NOT_FOUND',
            `w bazie nie ma wpisu ze slugiem i lokalizacjami ${locationSlugs.join(', ')} ` +
                '— najpierw npm run db:add (albo db:backfill-slugs)',
        );
    }
    if (serviceSlugs.length > 1) {
        throw new PremiumContentError(
            'ENTRY_AMBIGUOUS',
            `lokalizacje ${locationSlugs.join(', ')} naleza do kilku wpisow: ${serviceSlugs.join(', ')}`,
        );
    }

    return serviceSlugs[0];
}

/**
 * Wszystko, co moze zawiesc, przed zapisem: pliki zdjec i istnienie uslugi.
 * Niczego nie zapisuje — z tego korzysta `--dry-run`.
 */
export async function preparePremiumUpsert(
    store: PremiumContentStore,
    { serviceSlug, content, publicDir }: PremiumUpsertInput,
): Promise<PremiumUpsertPlan> {
    const missing = findMissingPremiumImages(serviceSlug, content, publicDir);
    if (missing.length > 0) {
        throw new PremiumContentError(
            'IMAGES_MISSING',
            `brak plikow w public/: ${missing.join(', ')}`,
            missing,
        );
    }

    const serviceId = await store.findServiceIdBySlug(serviceSlug);
    if (serviceId === null) {
        throw new PremiumContentError(
            'SERVICE_NOT_FOUND',
            `w bazie nie ma uslugi o slugu "${serviceSlug}"`,
        );
    }

    return { serviceId, previous: toPrevious(await store.findContent(serviceId)) };
}

function toPrevious(stored: unknown): PreviousPremiumContent {
    if (stored === null) return { kind: 'none' };

    const parsed = premiumContentSchema.safeParse(stored);
    return parsed.success ? { kind: 'valid', content: parsed.data } : { kind: 'invalid' };
}

/** Idempotentny upsert: ponowne uruchomienie z ta sama trescia nic nie zmienia. */
export async function upsertPremiumContent(
    store: PremiumContentStore,
    input: PremiumUpsertInput,
): Promise<PremiumUpsertPlan> {
    const plan = await preparePremiumUpsert(store, input);
    await store.saveContent(plan.serviceId, input.content);

    return plan;
}

export type PremiumEntriesReport = {
    /** Slugi uslug z opublikowana trescia. */
    published: string[];
    /** Pliki z blokiem `premium`, ktorych wpisu nie ma w bazie (np. nieprzepisany do seeda). */
    skipped: { file: string; reason: string }[];
};

function hasPremiumBlock(raw: unknown): boolean {
    return typeof raw === 'object' && raw !== null && 'premium' in raw;
}

/**
 * Seed: upsert tresci z kazdego pliku `<dataDir>/*.json` z blokiem `premium`, zeby
 * `db:reset` jej nie gubil. Pliki bez bloku nie sa walidowane (nie blokuja seeda).
 * Bledny blok albo brak zdjecia przerywa — tak samo jak `db:premium`.
 */
export async function publishPremiumEntries(
    store: PremiumContentStore,
    { dataDir, publicDir }: { dataDir: string; publicDir: string },
): Promise<PremiumEntriesReport> {
    const report: PremiumEntriesReport = { published: [], skipped: [] };
    const files = (await readdir(dataDir)).filter(file => file.endsWith('.json')).toSorted();

    // Kolejno, nie rownolegle: kilka wpisow premium, a czytelny log bledu jest wazniejszy.
    for (const file of files) {
        const raw: unknown = JSON.parse(await readFile(path.join(dataDir, file), 'utf8'));
        if (!hasPremiumBlock(raw)) continue;

        const parsed = serviceInputSchema.safeParse(raw);
        if (!parsed.success) {
            const issues = parsed.error.issues.map(
                issue => `${issue.path.join('.') || '(korzen)'}: ${issue.message}`,
            );
            throw new PremiumContentError('INVALID_ENTRY', `${file}: ${issues.join('; ')}`);
        }
        const entry = parsed.data;
        if (!entry.premium) continue;

        let serviceSlug: string;
        try {
            serviceSlug = await resolveEntryServiceSlug(store, entry);
        } catch (error) {
            if (!(error instanceof PremiumContentError) || error.code !== 'SERVICE_NOT_FOUND')
                throw error;
            report.skipped.push({ file, reason: error.message });
            continue;
        }

        await upsertPremiumContent(store, { serviceSlug, content: entry.premium, publicDir });
        report.published.push(serviceSlug);
    }

    return report;
}

/** `insert … on conflict (service_id) do update` — jeden wiersz na usluge. */
export function buildSavePremiumContentQuery(
    db: PostgresJsDatabase,
    serviceId: string,
    content: PremiumContentData,
) {
    const values = {
        template: content.template,
        coverImage: content.coverImage,
        gallery: content.gallery,
        priceList: content.priceList,
        faq: content.faq,
    };

    return db
        .insert(serviceProfilesTable)
        .values({ serviceId, ...values })
        .onConflictDoUpdate({
            target: serviceProfilesTable.serviceId,
            set: { ...values, updatedAt: sql`now()` },
        });
}

export function createPremiumContentStore(db: PostgresJsDatabase): PremiumContentStore {
    return {
        async findServiceIdBySlug(serviceSlug) {
            const [row] = await db
                .select({ id: servicesTable.id })
                .from(servicesTable)
                .where(eq(servicesTable.slug, serviceSlug))
                .limit(1);

            return row?.id ?? null;
        },

        async findServiceSlugsByLocationSlugs(locationSlugs) {
            const rows = await db
                .selectDistinct({ slug: servicesTable.slug })
                .from(serviceLocationsTable)
                .innerJoin(servicesTable, eq(servicesTable.id, serviceLocationsTable.serviceId))
                .where(inArray(serviceLocationsTable.slug, [...locationSlugs]));

            // Usluga bez slugu (przed backfillem) nie ma adresu profilu ani katalogu zdjec.
            return rows.flatMap(({ slug }) => (slug === null ? [] : [slug]));
        },

        async findContent(serviceId) {
            const [row] = await db
                .select({
                    template: serviceProfilesTable.template,
                    coverImage: serviceProfilesTable.coverImage,
                    gallery: serviceProfilesTable.gallery,
                    priceList: serviceProfilesTable.priceList,
                    faq: serviceProfilesTable.faq,
                })
                .from(serviceProfilesTable)
                .where(eq(serviceProfilesTable.serviceId, serviceId))
                .limit(1);

            return row ?? null;
        },

        async saveContent(serviceId, content) {
            await buildSavePremiumContentQuery(db, serviceId, content);
        },
    };
}
