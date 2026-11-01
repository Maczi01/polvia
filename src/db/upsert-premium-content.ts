import { existsSync, readdirSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
    describeActiveUntilProblem,
    MANUAL_PREMIUM_MAX_YEARS_AHEAD,
} from '../lib/manual-premium';
import { formatZodIssue } from './format-zod-issue';
import {
    type PremiumContentData,
    premiumContentSchema,
    premiumImageFiles,
} from './premium-content-schema';
import { buildLocationSlugs, serviceInputSchema, type ServiceInput } from './service-input-schema';

/**
 * Publikacja tresci premium (`db:premium`, seed): upsert wiersza `service_profiles`
 * uslugi znalezionej po slugach lokalizacji wpisu. Modul nie importuje `./index` (polaczenie
 * z baza przy ladowaniu), tylko dostaje magazyn — dzieki temu da sie go testowac bez bazy.
 * Adapter Drizzle magazynu: `premium-content-store.ts`.
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

/** Usluga z adresem profilu (slug ustalony). */
export type ServiceRef = { id: string; slug: string };

/** Usluga, ktorej dotyczy plik wpisu: id do zapisu, slug do katalogu zdjec i adresu profilu. */
export type EntryService = { serviceId: string; serviceSlug: string };

/** Dostep do bazy potrzebny publikacji — produkcyjnie `createPremiumContentStore(db)`. */
export type PremiumContentStore = {
    /** Uslugi, do ktorych naleza podane lokalizacje (bez powtorzen, tylko ze slugiem). */
    findServicesByLocationSlugs(locationSlugs: readonly string[]): Promise<ServiceRef[]>;
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
    service: EntryService;
    content: PremiumContentData;
    /** Katalog `public/` (zdjecia leza w `<publicDir>/services/<service.serviceSlug>/`). */
    publicDir: string;
};

/**
 * Pliki tresci, ktorych nie ma na dysku, jako `services/<slug>/<plik>` (wzgledem `public/`).
 * Porownuje z dokladnymi nazwami z katalogu, nie przez `existsSync`: Windows nie rozroznia
 * wielkosci liter, a Vercel tak — `Cover.JPG` przy `cover.jpg` dalby 404 dopiero na produkcji.
 */
export function findMissingPremiumImages(
    serviceSlug: string,
    content: PremiumContentData,
    publicDir: string,
): string[] {
    const directory = path.join(publicDir, 'services', serviceSlug);
    const present = new Set(existsSync(directory) ? readdirSync(directory) : []);

    return premiumImageFiles(content)
        .filter(file => !present.has(file))
        .map(file => path.posix.join('services', serviceSlug, file));
}

/**
 * Usluga, ktora utworzyl plik wpisu. Szukana po slugach lokalizacji (jednoznaczne,
 * liczone z `slug` w JSON), a nie po `buildServiceSlug(name)`: przy duplikacie nazwy
 * wpis ma adres `nazwa-2`, a slug z nazwy wskazalby cudzy profil.
 */
export async function resolveEntryService(
    store: PremiumContentStore,
    input: { slug: ServiceInput['slug']; locations: readonly { city: string }[] },
): Promise<EntryService> {
    const locationSlugs = buildLocationSlugs(
        input.slug,
        input.locations.map(location => location.city),
    );
    const [service, ...others] = await store.findServicesByLocationSlugs(locationSlugs);

    if (service === undefined) {
        throw new PremiumContentError(
            'SERVICE_NOT_FOUND',
            `w bazie nie ma wpisu ze slugiem i lokalizacjami ${locationSlugs.join(', ')} ` +
                '— najpierw npm run db:add (albo db:backfill-slugs)',
        );
    }
    if (others.length > 0) {
        const slugs = [service, ...others].map(({ slug }) => slug).join(', ');
        throw new PremiumContentError(
            'ENTRY_AMBIGUOUS',
            `lokalizacje ${locationSlugs.join(', ')} naleza do kilku wpisow: ${slugs}`,
        );
    }

    return { serviceId: service.id, serviceSlug: service.slug };
}

/**
 * Wszystko, co moze zawiesc, przed zapisem: pliki zdjec (usluge ustala `resolveEntryService`).
 * Niczego nie zapisuje — z tego korzysta `--dry-run`.
 */
export async function preparePremiumUpsert(
    store: PremiumContentStore,
    { service, content, publicDir }: PremiumUpsertInput,
): Promise<PremiumUpsertPlan> {
    const missing = findMissingPremiumImages(service.serviceSlug, content, publicDir);
    if (missing.length > 0) {
        throw new PremiumContentError(
            'IMAGES_MISSING',
            `brak plikow w public/: ${missing.join(', ')}`,
            missing,
        );
    }

    const { serviceId } = service;
    return { serviceId, previous: toPrevious(await store.findContent(serviceId)) };
}

function toPrevious(stored: unknown): PreviousPremiumContent {
    if (stored === null) return { kind: 'none' };

    const parsed = premiumContentSchema.safeParse(stored);
    return parsed.success ? { kind: 'valid', content: parsed.data } : { kind: 'invalid' };
}

/**
 * Ostrzezenie o podejrzanej dacie premium recznego (`db:premium`, seed) albo `null`.
 * Schemat sprawdza tylko format — data z przeszlosci albo literowka roku przeszlaby cicho.
 */
export function activeUntilWarning(content: PremiumContentData, now: Date): string | null {
    const { activeUntil } = content;
    if (activeUntil === undefined) return null;

    const problem = describeActiveUntilProblem(activeUntil, now);
    if (problem === null) return null;
    return problem === 'past'
        ? `premium.activeUntil ${activeUntil} jest w przeszlosci — premium reczne juz wygaslo`
        : `premium.activeUntil ${activeUntil} wypada ponad ${MANUAL_PREMIUM_MAX_YEARS_AHEAD} ` +
              'lata naprzod — literowka w roku?';
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
    /**
     * Pliki pominiete: z blokiem `premium`, ale bez wpisu w bazie (np. nieprzepisany do
     * seeda), albo nieparsowalne (bez parsowania nie wiadomo, czy to wpis premium).
     */
    skipped: { file: string; reason: string }[];
    /** Opublikowane mimo podejrzanej daty `activeUntil` (`activeUntilWarning`). */
    warnings: { file: string; message: string }[];
};

function hasPremiumBlock(raw: unknown): boolean {
    return typeof raw === 'object' && raw !== null && 'premium' in raw;
}

type ParsedJson = { isValid: true; value: unknown } | { isValid: false };

function parseJson(text: string): ParsedJson {
    try {
        return { isValid: true, value: JSON.parse(text) };
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return { isValid: false };
    }
}

/**
 * Seed: upsert tresci z kazdego pliku `<dataDir>/*.json` z blokiem `premium`, zeby
 * `db:reset` jej nie gubil. Pliki bez bloku nie sa walidowane, a nieparsowalne (plik roboczy)
 * trafiaja do `skipped` — zadne nie blokuje seeda. Bledny blok, brak zdjecia albo wpis
 * wskazujacy kilka uslug przerywa — tak samo jak `db:premium`.
 */
export async function publishPremiumEntries(
    store: PremiumContentStore,
    { dataDir, publicDir }: { dataDir: string; publicDir: string },
): Promise<PremiumEntriesReport> {
    const report: PremiumEntriesReport = { published: [], skipped: [], warnings: [] };
    const files = (await readdir(dataDir)).filter(file => file.endsWith('.json')).toSorted();

    // Kolejno, nie rownolegle: kilka wpisow premium, a czytelny log bledu jest wazniejszy.
    for (const file of files) {
        const json = parseJson(await readFile(path.join(dataDir, file), 'utf8'));
        if (!json.isValid) {
            report.skipped.push({ file, reason: 'niepoprawny JSON' });
            continue;
        }
        if (!hasPremiumBlock(json.value)) continue;

        const parsed = serviceInputSchema.safeParse(json.value);
        if (!parsed.success) {
            const issues = parsed.error.issues.map(issue => formatZodIssue(issue));
            throw new PremiumContentError('INVALID_ENTRY', `${file}: ${issues.join('; ')}`);
        }
        const entry = parsed.data;
        if (!entry.premium) continue;

        let service: EntryService;
        try {
            service = await resolveEntryService(store, entry);
        } catch (error) {
            if (!(error instanceof PremiumContentError) || error.code !== 'SERVICE_NOT_FOUND')
                throw error;
            report.skipped.push({ file, reason: error.message });
            continue;
        }

        await upsertPremiumContent(store, { service, content: entry.premium, publicDir });
        report.published.push(service.serviceSlug);
        const warning = activeUntilWarning(entry.premium, new Date());
        if (warning !== null) report.warnings.push({ file, message: warning });
    }

    return report;
}
