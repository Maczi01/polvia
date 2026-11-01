import { createHash, timingSafeEqual } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
    checkRateLimit,
    type RateLimitResult,
    RateLimitStoreError,
    rateLimitSubject,
} from '@/lib/rate-limit';
import { getServiceSlugStatus } from '@/lib/service-profile-queries';
import { isValidServiceSlug } from '@/lib/service-slug-format';
import {
    ALIAS_QUERY_PARAM,
    SERVICE_SLUG_LOOKUP_SECRET_HEADER,
} from '@/lib/service-slug-lookup';

import { env } from '../../../../../env';

/**
 * Lookup istnienia profilu `/firma/<slug>` i aktywnego premium (krotki adres `/<slug>`)
 * dla `src/middleware.ts`.
 *
 * Middleware dziala na edge bez dostepu do bazy, wiec pyta ten handler (Node + db)
 * przed renderem — tylko tam da sie jeszcze zwrocic prawdziwy status 404.
 */
export const runtime = 'nodejs';

/**
 * Limit dla ruchu publicznego (bez sekretu). Endpoint jest tani (indeksowany SELECT po
 * unikalnym slugu) i oddaje tylko `exists` i `hasActivePremium` — oba fakty i tak widac
 * publicznie (profil, krotki adres); limit odbiera sens masowemu odpytywaniu.
 *
 * Ruch z middleware (z poprawnym sekretem) idzie BEZ limitu: na Vercelu wszystkie fetche
 * z middleware maja jeden adres wychodzacy, wiec limit po IP bylby globalnym kubelkiem,
 * ktory przy ruchu wylaczalby 404 w calym serwisie. Kazdy taki lookup odpowiada jednemu
 * wejsciu na strone profilu, ktora sama robi wiecej zapytan do bazy — limit lookupu nie
 * chronilby bazy, tylko zamienialby 404 w soft-404. Powtorzenia tego samego slugu
 * obsluguje CDN (`Cache-Control`).
 */
const SLUG_LOOKUP_RATE_LIMIT = {
    maxRequestsPerIp: 120,
    windowSeconds: 60,
};

/**
 * Odpowiedz nie zalezy od sekretu (rozni sie tylko limitem), wiec CDN moze ja wspoldzielic
 * miedzy ruchem zaufanym i publicznym.
 *
 * Dwa klucze cache dla tego samego slugu (`ALIAS_QUERY_PARAM`):
 * - profil `/firma/<slug>` potrzebuje tylko `exists`, wiec dlugie `stale-while-revalidate`:
 *   CDN odpowiada od razu z kopii, a funkcja (zimny start + baza) odswieza ja w tle —
 *   wejscie na profil nie czeka na lookup,
 * - krotki adres `polvia.pl/<slug>` zalezy od `hasActivePremium` i zaczyna/przestaje
 *   przekierowywac najpozniej 5 min po zmianie premium: najstarsza odpowiedz, jaka CDN moze
 *   podac, ma `s-maxage + stale-while-revalidate` sekund, wiec ta suma wynosi 300.
 *
 * `missing` krotko, zeby nowo dodany wpis szybko przestal dawac 404, ale ze
 * `stale-while-revalidate`: unikalne sciezki skanerow i tak omijaja cache, a powtarzane
 * 404 (linki z zewnatrz do usunietych wpisow) nie czekaja na funkcje. Nowy wpis moze
 * dostac 404 jeszcze do ~5,5 min po dodaniu, jesli jego slug byl wczesniej odpytany.
 */
const CACHE_CONTROL = {
    profileExists: 'public, s-maxage=300, stale-while-revalidate=86400',
    aliasExists: 'public, s-maxage=240, stale-while-revalidate=60',
    missing: 'public, s-maxage=30, stale-while-revalidate=300',
    /** 400/429/500 nie moga trafic do CDN — inaczej jeden klient zablokowalby slug wszystkim. */
    uncacheable: 'private, no-store',
} as const;

/** Podmiot limitu, gdy platforma nie podala adresu klienta (lokalnie, poza Vercelem). */
const UNKNOWN_CLIENT = 'unknown';

const slugParamsSchema = z.object({
    slug: z.string().refine(isValidServiceSlug, 'Invalid service slug format'),
});

type RouteContext = { params: Promise<{ slug: string }> };

function sha256(value: string): Buffer {
    return createHash('sha256').update(value).digest();
}

/**
 * Czy zadanie przyszlo z middleware. Porownanie w czasie stalym na skrotach SHA-256:
 * `timingSafeEqual` wymaga buforow rownej dlugosci, a skrot nie zdradza dlugosci sekretu.
 */
function isTrustedLookup(request: NextRequest): boolean {
    const provided = request.headers.get(SERVICE_SLUG_LOOKUP_SECRET_HEADER);
    if (!provided) return false;

    return timingSafeEqual(sha256(provided), sha256(env.SERVICE_SLUG_LOOKUP_SECRET));
}

/**
 * Adres klienta z naglowka, ktory ustawia platforma. NIE `x-forwarded-for` z `getClientIp`:
 * poza Vercelem (i za wlasnym proxy) klient go podrabia, a rotujac wartosc omijalby limit.
 * Vercel nadpisuje `x-vercel-forwarded-for` i `x-real-ip` adresem klienta i nie przyjmuje
 * wartosci z zewnatrz (docs: vercel.com/docs/headers/request-headers). Bez nich wszystkie
 * zadania dziela jeden kubelek — bezpieczny kierunek bledu.
 */
function getPlatformClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip')?.trim() ||
        UNKNOWN_CLIENT
    );
}

/**
 * Limit z fail-open: lookup sluzy tylko do zwrocenia 404 zamiast soft-404, wiec awaria
 * Redisa nie moze blokowac profili. Kazda inna awaria leci wyzej (500 → middleware
 * i tak przepuszcza zadanie).
 */
async function checkLookupRateLimit(request: NextRequest): Promise<RateLimitResult> {
    try {
        return await checkRateLimit({
            key: `service_slug_ip:${rateLimitSubject(getPlatformClientIp(request))}`,
            max: SLUG_LOOKUP_RATE_LIMIT.maxRequestsPerIp,
            windowSeconds: SLUG_LOOKUP_RATE_LIMIT.windowSeconds,
        });
    } catch (error) {
        if (!(error instanceof RateLimitStoreError)) throw error;

        console.error('Service slug lookup: rate limit store unavailable, allowing request', error);
        return { allowed: true, remaining: SLUG_LOOKUP_RATE_LIMIT.maxRequestsPerIp };
    }
}

function errorResponse(
    code: string,
    message: string,
    status: number,
    headers: Record<string, string> = {},
): NextResponse {
    return NextResponse.json(
        { data: null, error: { code, message } },
        { status, headers: { 'Cache-Control': CACHE_CONTROL.uncacheable, ...headers } },
    );
}

function cacheControlFor(exists: boolean, isAliasLookup: boolean): string {
    if (!exists) return CACHE_CONTROL.missing;

    return isAliasLookup ? CACHE_CONTROL.aliasExists : CACHE_CONTROL.profileExists;
}

export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
    try {
        if (!isTrustedLookup(request)) {
            const rate = await checkLookupRateLimit(request);

            if (!rate.allowed) {
                return errorResponse('RATE_LIMITED', 'Too many slug lookups', 429, {
                    'Retry-After': String(rate.retryAfter),
                });
            }
        }

        const parsed = slugParamsSchema.safeParse(await params);

        if (!parsed.success) {
            return errorResponse(
                'BAD_REQUEST',
                parsed.error.issues[0]?.message ?? 'Invalid service slug',
                400,
            );
        }

        const { exists, hasActivePremium } = await getServiceSlugStatus(parsed.data.slug);
        const isAliasLookup = request.nextUrl.searchParams.has(ALIAS_QUERY_PARAM);

        return NextResponse.json(
            { data: { exists, hasActivePremium }, error: null },
            { headers: { 'Cache-Control': cacheControlFor(exists, isAliasLookup) } },
        );
    } catch (error) {
        // Szczegoly tylko w logach serwera — surowy blad bazy nie leci do klienta.
        console.error('Service slug lookup failed:', error);

        return errorResponse('LOOKUP_FAILED', 'Slug lookup failed', 500);
    }
}
