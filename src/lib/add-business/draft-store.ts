import 'server-only';

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { coverageEnum, voivodeshipEnum } from '@/db/schema';
import { type Locale, locales } from '@/i18n/config';
import type { Voivodeship } from '@/lib/add-business/geocode';
import { type BusinessDraft, FACT_FIELDS, LANGUAGE_CODES } from '@/lib/add-business/draft-schema';
import { CATEGORY_VALUES } from '@/lib/categories';
import { checkRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

/**
 * Szkic wpisu po stronie serwera (D2).
 *
 * Klient dostaje tylko `draftId`. Kategoria, zasieg, tagi i opisy przy wysylce pochodza
 * wylacznie stad, wiec R9 jest egzekwowane serwerowo. Szkic jest jednorazowy:
 * `consumeDraft` pobiera i usuwa go atomowo (GETDEL).
 *
 * Wynik geokodowania (`geo`) nie jest czescia `BusinessDraft`, ale trzymamy go tutaj:
 * submit musi miec wspolrzedne, a `relocate` je podmienia. `geo.address` to adres, ktory
 * geokodowano — submit porownuje z nim adres po edycji i geokoduje ponownie tylko przy
 * roznicy.
 */

export const DRAFT_TTL_SECONDS = 2 * 60 * 60;
/** D7: tyle przesuniec pinu (ponownych geokodowan) na jeden szkic. */
export const MAX_RELOCATIONS = 10;

const DRAFT_KEY_PREFIX = 'add-business:draft:';

export type DraftSource = 'page' | 'owner';

export interface DraftGeo {
    lat: number;
    lng: number;
    approximate: boolean;
    voivodeship: Voivodeship | null;
    postcode: string | null;
    /** Adres, dla ktorego policzono wspolrzedne. */
    address: { street: string | null; city: string };
}

export interface StoredDraft {
    draft: BusinessDraft;
    locale: Locale;
    source: DraftSource;
    /** Link podany przez wlasciciela; w trybie recznym moze go nie byc. */
    sourceUrl: string | null;
    /** Absolutny URL proponowanego logo ze strony (R11). */
    logoCandidate: string | null;
    /** `null`: wpis `online` albo geokoder nie trafil (D3 — nie blokuje wysylki). */
    geo: DraftGeo | null;
}

export type DraftExpired = { ok: false; code: 'DRAFT_EXPIRED' };

export type DraftReadResult = { ok: true; stored: StoredDraft } | DraftExpired;

export type DraftWriteResult = { ok: true } | DraftExpired;

export type RelocationReservation =
    | { ok: true; remaining: number }
    | { ok: false; code: 'DRAFT_EXPIRED' | 'RELOCATION_LIMIT' };

const EXPIRED: DraftExpired = { ok: false, code: 'DRAFT_EXPIRED' };

const draftIdSchema = z.string().uuid();

const localizedTextSchema = z
    .object({
        pl: z.string().min(1),
        uk: z.string().min(1),
        en: z.string().min(1),
        ru: z.string().min(1),
    })
    .strict();

const openingHoursSchema = z.record(
    z.string(),
    z.object({ open: z.string(), close: z.string() }).strict(),
);

const businessDraftSchema = z
    .object({
        category: z.enum(CATEGORY_VALUES),
        coverage: z.enum(coverageEnum.enumValues),
        languages: z.array(z.enum(LANGUAGE_CODES)),
        tags: z.array(localizedTextSchema),
        descriptions: localizedTextSchema,
        facts: z
            .object({
                name: z.string().nullable(),
                street: z.string().nullable(),
                postcode: z.string().nullable(),
                city: z.string().nullable(),
                phoneNumber: z.string().nullable(),
                email: z.string().nullable(),
                openingHours: openingHoursSchema.nullable(),
            })
            .strict(),
        unconfirmed: z.array(z.enum(FACT_FIELDS)),
    })
    .strict() satisfies z.ZodType<BusinessDraft>;

const draftGeoSchema = z
    .object({
        lat: z.number(),
        lng: z.number(),
        approximate: z.boolean(),
        voivodeship: z.enum(voivodeshipEnum.enumValues).nullable(),
        postcode: z.string().nullable(),
        address: z.object({ street: z.string().nullable(), city: z.string() }).strict(),
    })
    .strict() satisfies z.ZodType<DraftGeo>;

/** Dane z Redisa to granica systemu — odczyt zawsze przez ten schemat. */
const storedDraftSchema = z
    .object({
        draft: businessDraftSchema,
        locale: z.enum(locales),
        source: z.enum(['page', 'owner']),
        sourceUrl: z.string().nullable(),
        logoCandidate: z.string().nullable(),
        geo: draftGeoSchema.nullable(),
    })
    .strict() satisfies z.ZodType<StoredDraft>;

function draftKey(draftId: string): string {
    return `${DRAFT_KEY_PREFIX}${draftId}`;
}

function relocationKey(draftId: string): string {
    return `${DRAFT_KEY_PREFIX}${draftId}:relocations`;
}

function isValidDraftId(draftId: string): boolean {
    return draftIdSchema.safeParse(draftId).success;
}

function parseStored(draftId: string, raw: string | null): DraftReadResult {
    if (raw === null) return EXPIRED;

    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        console.warn('add-business draft unreadable', { draftId, reason: 'invalid-json' });
        return EXPIRED;
    }

    const parsed = storedDraftSchema.safeParse(json);
    if (!parsed.success) {
        // Tylko sciezki pol — wartosci to dane firmy i adres e-mail.
        console.warn('add-business draft unreadable', {
            draftId,
            reason: 'schema',
            paths: parsed.error.issues.map(issue => issue.path.join('.')),
        });
        return EXPIRED;
    }

    return { ok: true, stored: parsed.data };
}

/** Zapisuje nowy szkic z TTL 2 h i zwraca jego identyfikator. */
export async function saveDraft(stored: StoredDraft): Promise<string> {
    const draftId = randomUUID();
    await redis.set(draftKey(draftId), JSON.stringify(stored), 'EX', DRAFT_TTL_SECONDS);
    return draftId;
}

/** Odczyt bez usuwania — dla podgladu i `relocate`. */
export async function getDraft(draftId: string): Promise<DraftReadResult> {
    if (!isValidDraftId(draftId)) return EXPIRED;

    return parseStored(draftId, await redis.get(draftKey(draftId)));
}

/**
 * Pobiera i usuwa szkic jednym poleceniem. Drugi submit z tym samym `draftId`
 * dostaje `DRAFT_EXPIRED` — bez tego mozna by wysylac dowolna tresc cudzym mailem
 * bez kosztu generowania.
 */
export async function consumeDraft(draftId: string): Promise<DraftReadResult> {
    if (!isValidDraftId(draftId)) return EXPIRED;

    return parseStored(draftId, await redis.getdel(draftKey(draftId)));
}

/**
 * Podmienia wynik geokodowania. `KEEPTTL` zachowuje pozostaly czas zycia — kolejne
 * relokacje nie przedluzaja szkicu w nieskonczonosc. `XX` nie wskrzesza szkicu,
 * ktory w miedzyczasie wygasl albo zostal wyslany.
 */
export async function updateDraftGeo(
    draftId: string,
    geo: DraftGeo | null,
): Promise<DraftWriteResult> {
    const current = await getDraft(draftId);
    if (!current.ok) return current;

    const next: StoredDraft = { ...current.stored, geo };
    const written = await redis.set(draftKey(draftId), JSON.stringify(next), 'KEEPTTL', 'XX');

    return written === 'OK' ? { ok: true } : EXPIRED;
}

/**
 * Rezerwuje jedna relokacje (D7: 10 na szkic). Wolac PRZED geokodowaniem.
 *
 * Licznik jest osobnym kluczem z atomowym INCR, a nie polem w JSON-ie szkicu:
 * odczyt-modyfikacja-zapis pola przepuscilby dowolnie wiele rownoleglych zadan,
 * a WATCH nie dziala na wspoldzielonym polaczeniu ioredis. Okno licznika = TTL
 * szkicu, wiec licznik zyje co najmniej tak dlugo jak szkic.
 */
export async function reserveRelocation(draftId: string): Promise<RelocationReservation> {
    if (!isValidDraftId(draftId)) return EXPIRED;

    const result = await checkRateLimit({
        key: relocationKey(draftId),
        max: MAX_RELOCATIONS,
        windowSeconds: DRAFT_TTL_SECONDS,
    });

    if (!result.allowed) return { ok: false, code: 'RELOCATION_LIMIT' };

    return { ok: true, remaining: result.remaining };
}
