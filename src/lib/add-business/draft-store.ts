import 'server-only';

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { locales } from '@/i18n/config';
import { businessDraftSchema } from '@/lib/add-business/draft-schema';
import type { GeocodeAddress, GeocodeResult } from '@/lib/add-business/geocode';
import { checkRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';
import { VOIVODESHIP_VALUES } from '@/lib/voivodeships';

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
 *
 * Zapis i odczyt ida przez ten sam `storedDraftSchema`: zapis rzuca (blad programisty
 * nie moze zapisac szkicu, ktorego odczyt dalby potem ciche `DRAFT_EXPIRED`).
 */

export const DRAFT_TTL_SECONDS = 2 * 60 * 60;
/** D7: tyle przesuniec pinu (ponownych geokodowan) na jeden szkic. */
export const MAX_RELOCATIONS = 10;

const DRAFT_KEY_PREFIX = 'add-business:draft:';

export type DraftExpired = { ok: false; code: 'DRAFT_EXPIRED' };

export type DraftReadResult = { ok: true; stored: StoredDraft } | DraftExpired;

export type DraftWriteResult = { ok: true } | DraftExpired;

export type RelocationReservation =
    | { ok: true; remaining: number }
    | { ok: false; code: 'DRAFT_EXPIRED' | 'RELOCATION_LIMIT' };

const EXPIRED: DraftExpired = { ok: false, code: 'DRAFT_EXPIRED' };

const draftIdSchema = z.string().uuid();

const draftGeoSchema = z
    .object({
        lat: z.number(),
        lng: z.number(),
        approximate: z.boolean(),
        voivodeship: z.enum(VOIVODESHIP_VALUES).nullable(),
        postcode: z.string().nullable(),
        /** Adres, dla ktorego policzono wspolrzedne. */
        address: z.object({ street: z.string().nullable(), city: z.string() }).strict(),
    })
    .strict();

export type DraftGeo = z.infer<typeof draftGeoSchema>;

/** Dane z Redisa to granica systemu — zapis i odczyt zawsze przez ten schemat. */
const storedDraftSchema = z
    .object({
        draft: businessDraftSchema,
        locale: z.enum(locales),
        source: z.enum(['page', 'owner']),
        /** Link podany przez wlasciciela; w trybie recznym moze go nie byc. */
        sourceUrl: z.string().nullable(),
        /** Absolutny URL proponowanego logo ze strony (R11). */
        logoCandidate: z.string().nullable(),
        /** `null`: wpis `online` albo geokoder nie trafil (D3 — nie blokuje wysylki). */
        geo: draftGeoSchema.nullable(),
    })
    .strict();

export type StoredDraft = z.infer<typeof storedDraftSchema>;

export type DraftSource = StoredDraft['source'];

type GeocodeSuccess = Extract<GeocodeResult, { ok: true }>;

/**
 * Sukces geokodowania → `DraftGeo`. Jawne mapowanie zamiast `{ ...result, address }`:
 * `ok` z wyniku geokodera nie przeszedlby `.strict()` i szkic bylby nie do zapisania.
 */
export function toDraftGeo(result: GeocodeSuccess, address: GeocodeAddress): DraftGeo {
    return {
        lat: result.lat,
        lng: result.lng,
        approximate: result.approximate,
        voivodeship: result.voivodeship,
        postcode: result.postcode,
        address: { street: address.street, city: address.city },
    };
}

/** Rzuca `ZodError` przy niepoprawnym ksztalcie — to blad wolajacego, nie danych z Redisa. */
function serializeStored(stored: StoredDraft): string {
    return JSON.stringify(storedDraftSchema.parse(stored));
}

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

/** Zapisuje nowy szkic z TTL 2 h i zwraca jego identyfikator. Niepoprawny szkic rzuca. */
export async function saveDraft(stored: StoredDraft): Promise<string> {
    const draftId = randomUUID();
    await redis.set(draftKey(draftId), serializeStored(stored), 'EX', DRAFT_TTL_SECONDS);
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
    const written = await redis.set(draftKey(draftId), serializeStored(next), 'KEEPTTL', 'XX');

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
