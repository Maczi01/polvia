import 'server-only';

import { z } from 'zod';

import { voivodeshipEnum } from '@/db/schema';
import { redis } from '@/lib/redis';

import { env } from '../../../env';

/**
 * Geokodowanie adresu firmy przez Nominatim (OSM) dla wpisow `local`/`hybrid`.
 *
 * Polityka Nominatim: maksymalnie 1 zapytanie na sekunde, identyfikujacy
 * User-Agent, cache wynikow. Kontrole poprawnosci odwzorowuja `/dodaj` faza 2.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_PREFIX = 'add-business:geocode:v1:';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
const LOCK_KEY = 'add-business:geocode:nominatim-lock';
const LOCK_TTL_MS = 1000;
const LOCK_RETRY_DELAY_MS = 1100;
const FETCH_TIMEOUT_MS = 8000;
const HTTP_TOO_MANY_REQUESTS = 429;

const POLAND_BOUNDS = { minLat: 49, maxLat: 55, minLng: 14, maxLng: 24 } as const;

export type Voivodeship = (typeof voivodeshipEnum.enumValues)[number];

export type GeocodeErrorCode = 'NOT_FOUND' | 'MISMATCH' | 'RATE_LIMITED' | 'UPSTREAM_FAILED';

export type GeocodeResult =
    | {
          ok: true;
          lat: number;
          lng: number;
          postcode: string | null;
          voivodeship: Voivodeship | null;
          approximate: boolean;
      }
    | { ok: false; code: GeocodeErrorCode };

export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface GeocodeAddress {
    /** Ulica z numerem budynku; `null`, gdy strona podaje samo miasto. */
    street: string | null;
    city: string;
}

export interface GeocodeOptions {
    /** Wspolrzedne z JSON-LD (`geo`). W zakresie Polski pomijaja wywolanie Nominatim. */
    knownGeo?: GeoPoint | null;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
}

const nominatimHitSchema = z.object({
    lat: z.coerce.number(),
    lon: z.coerce.number(),
    display_name: z.string(),
    address: z
        .object({
            house_number: z.string().optional(),
            postcode: z.string().optional(),
            state: z.string().optional(),
        })
        .optional(),
});

const nominatimResponseSchema = z.array(nominatimHitSchema);

type NominatimHit = z.infer<typeof nominatimHitSchema>;

/** Wpis w cache: trafienie albo jawne „nie znaleziono” (tez cache'owane). */
const cacheEntrySchema = z.object({ hit: nominatimHitSchema.nullable() });

type CacheEntry = z.infer<typeof cacheEntrySchema>;

type FetchOutcome = { ok: true; entry: CacheEntry } | { ok: false; code: GeocodeErrorCode };

export function isGeoInPoland(geo: GeoPoint | null | undefined): geo is GeoPoint {
    if (!geo) return false;
    if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return false;

    return (
        geo.lat >= POLAND_BOUNDS.minLat &&
        geo.lat <= POLAND_BOUNDS.maxLat &&
        geo.lng >= POLAND_BOUNDS.minLng &&
        geo.lng <= POLAND_BOUNDS.maxLng
    );
}

/** Ł/ł nie rozkladaja sie w NFD, wiec trzeba je zamienic recznie. */
function foldText(text: string): string {
    return text
        .normalize('NFD')
        .replaceAll(/[̀-ͯ]/g, '')
        .replaceAll('ł', 'l')
        .replaceAll('Ł', 'L')
        .toLowerCase()
        .replaceAll(/\s+/g, ' ')
        .trim();
}

export function mapVoivodeship(state?: string): Voivodeship | null {
    if (!state) return null;

    const candidate = foldText(state).replace(/^wojewodztwo /, '').replaceAll(' ', '-');

    return voivodeshipEnum.enumValues.find(value => value === candidate) ?? null;
}

function buildQuery(address: GeocodeAddress): string {
    const street = address.street?.trim();

    return street ? `${street}, ${address.city.trim()}` : address.city.trim();
}

function cacheKey(query: string): string {
    return `${CACHE_PREFIX}${foldText(query)}`;
}

async function readCache(key: string): Promise<CacheEntry | null> {
    const raw = await redis.get(key);
    if (raw === null) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
    }

    const result = cacheEntrySchema.safeParse(parsed);

    return result.success ? result.data : null;
}

async function writeCache(key: string, entry: CacheEntry): Promise<void> {
    await redis.set(key, JSON.stringify(entry), 'EX', CACHE_TTL_SECONDS);
}

async function tryAcquireLock(): Promise<boolean> {
    const result = await redis.set(LOCK_KEY, '1', 'PX', LOCK_TTL_MS, 'NX');

    return result === 'OK';
}

async function acquireLockWithRetry(sleep: (ms: number) => Promise<void>): Promise<boolean> {
    if (await tryAcquireLock()) return true;

    await sleep(LOCK_RETRY_DELAY_MS);

    return tryAcquireLock();
}

function nominatimUrl(query: string): string {
    const params = new URLSearchParams({
        q: query,
        countrycodes: 'pl',
        format: 'jsonv2',
        limit: '1',
        addressdetails: '1',
    });

    return `${NOMINATIM_URL}?${params.toString()}`;
}

async function fetchNominatim(query: string, fetchImpl: typeof fetch): Promise<FetchOutcome> {
    let response: Response;
    try {
        response = await fetchImpl(nominatimUrl(query), {
            headers: {
                'User-Agent': `polvia-katalog/1.0 (+${env.NEXT_PUBLIC_SITE_URL})`,
                Accept: 'application/json',
            },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
    } catch (error) {
        // Timeout, DNS, zerwane polaczenie — dla wolajacego to ten sam przypadek.
        if (error instanceof Error) return { ok: false, code: 'UPSTREAM_FAILED' };
        throw error;
    }

    if (response.status === HTTP_TOO_MANY_REQUESTS) return { ok: false, code: 'RATE_LIMITED' };
    if (!response.ok) return { ok: false, code: 'UPSTREAM_FAILED' };

    const parsed = nominatimResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) return { ok: false, code: 'UPSTREAM_FAILED' };

    return { ok: true, entry: { hit: parsed.data[0] ?? null } };
}

function evaluateHit(hit: NominatimHit | null, city: string): GeocodeResult {
    if (!hit) return { ok: false, code: 'NOT_FOUND' };

    const point = { lat: hit.lat, lng: hit.lon };
    if (!isGeoInPoland(point)) return { ok: false, code: 'MISMATCH' };
    if (!foldText(hit.display_name).includes(foldText(city))) {
        return { ok: false, code: 'MISMATCH' };
    }

    return {
        ok: true,
        lat: point.lat,
        lng: point.lng,
        postcode: hit.address?.postcode ?? null,
        voivodeship: mapVoivodeship(hit.address?.state),
        approximate: !hit.address?.house_number,
    };
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

/**
 * Wspolrzedne dla adresu w Polsce. Bledy Redisa nie sa tu tlumaczone na kod —
 * bez Redisa nie da sie dotrzymac limitu 1 req/s, wiec wolajacy dostaje wyjatek.
 */
export async function geocodeAddress(
    address: GeocodeAddress,
    options: GeocodeOptions = {},
): Promise<GeocodeResult> {
    if (isGeoInPoland(options.knownGeo)) {
        const { lat, lng } = options.knownGeo;
        return { ok: true, lat, lng, postcode: null, voivodeship: null, approximate: false };
    }
    if (!address.city.trim()) return { ok: false, code: 'NOT_FOUND' };

    const query = buildQuery(address);
    const key = cacheKey(query);

    const cached = await readCache(key);
    if (cached) return evaluateHit(cached.hit, address.city);

    const hasLock = await acquireLockWithRetry(options.sleep ?? defaultSleep);
    if (!hasLock) return { ok: false, code: 'RATE_LIMITED' };

    const outcome = await fetchNominatim(query, options.fetchImpl ?? fetch);
    if (!outcome.ok) return { ok: false, code: outcome.code };

    await writeCache(key, outcome.entry);

    return evaluateHit(outcome.entry.hit, address.city);
}
