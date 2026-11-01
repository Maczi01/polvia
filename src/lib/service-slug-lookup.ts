import { z } from 'zod';

/**
 * Lookup istnienia profilu i aktywnego premium z middleware: `GET /api/service-slug/<slug>`.
 *
 * Wydzielony z `src/middleware.ts` (nie laduje sie w Jescie przez ESM `next-intl/middleware`).
 * Middleware dziala na edge bez bazy, wiec pyta route handler na Node.
 */

/**
 * - `profile` — `/firma/<slug>`: rozstrzyga tylko 404, wiec po timeoucie profil i tak sie
 *   renderuje (fail-open). Lookup blokuje KAZDE wejscie na profil — krotki limit.
 * - `alias` — `polvia.pl/<slug>`: po timeoucie 404 zamiast przekierowania na profil.
 *   Kandydatami sa wylacznie sciezki, ktore bez aliasu i tak dalyby 404, wiec dluzsze
 *   czekanie nie spowalnia zadnej istniejacej strony, a pokrywa zimny start funkcji
 *   z polaczeniem do bazy (rzadki adres z ulotki prawie zawsze trafia na miss CDN).
 */
export type ServiceSlugLookupPurpose = 'profile' | 'alias';

export const SERVICE_SLUG_LOOKUP_TIMEOUT_MS: Record<ServiceSlugLookupPurpose, number> = {
    profile: 1500,
    alias: 5000,
};

/**
 * Parametr zapytania lookupu dla krotkiego adresu. Osobny URL = osobny klucz cache CDN:
 * alias potrzebuje swiezego `hasActivePremium` (≤ 5 min), profil tylko `exists`
 * i moze dostac dluga kopie z `stale-while-revalidate` (patrz route handler).
 */
export const ALIAS_QUERY_PARAM = 'premium';

/**
 * Naglowek z sekretem `SERVICE_SLUG_LOOKUP_SECRET`: handler rozpoznaje po nim ruch
 * z middleware. Wspolny dla obu stron, wiec mieszka w module bez zaleznosci od Node.
 */
export const SERVICE_SLUG_LOOKUP_SECRET_HEADER = 'x-service-slug-lookup-secret';

/**
 * - `premium` — wpis istnieje i ma aktywne premium (krotki adres `/<slug>` przekierowuje),
 * - `found` — wpis istnieje bez aktywnego premium,
 * - `missing` — wpisu nie ma,
 * - `unknown` — timeout, blad sieci, status inny niz 2xx albo odpowiedz w zlym ksztalcie.
 *   Wolajacy przepuszcza wtedy zadanie (fail-open), zamiast blokowac profil.
 */
export type ServiceSlugLookupResult = 'premium' | 'found' | 'missing' | 'unknown';

export interface ServiceSlugLookupOptions {
    /** `request.nextUrl.origin` — lookup idzie do tej samej aplikacji. */
    origin: string;
    /** Slug po walidacji formatu (`isValidServiceSlug`). */
    slug: string;
    /** `env.SERVICE_SLUG_LOOKUP_SECRET` — zaufany ruch omija limit po IP w handlerze. */
    secret: string;
    purpose: ServiceSlugLookupPurpose;
}

function lookupUrl(origin: string, slug: string, purpose: ServiceSlugLookupPurpose): string {
    const url = `${origin}/api/service-slug/${encodeURIComponent(slug)}`;
    return purpose === 'alias' ? `${url}?${ALIAS_QUERY_PARAM}=1` : url;
}

const lookupResponseSchema = z.object({
    data: z.object({ exists: z.boolean(), hasActivePremium: z.boolean() }),
});

/**
 * Bez `cache: 'no-store'`: odpowiedz handlera niesie `Cache-Control` z `s-maxage`, wiec
 * powtarzane lookupy tego samego slugu obsluguje CDN, a nie funkcja z baza.
 */
export async function lookupServiceSlug({
    origin,
    slug,
    secret,
    purpose,
}: ServiceSlugLookupOptions): Promise<ServiceSlugLookupResult> {
    try {
        const response = await fetch(lookupUrl(origin, slug, purpose), {
            headers: { [SERVICE_SLUG_LOOKUP_SECRET_HEADER]: secret },
            signal: AbortSignal.timeout(SERVICE_SLUG_LOOKUP_TIMEOUT_MS[purpose]),
        });

        if (!response.ok) {
            console.error(`Service slug lookup returned HTTP ${response.status}, passing request through`);
            return 'unknown';
        }

        const parsed = lookupResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
            console.error('Service slug lookup returned unexpected body, passing request through');
            return 'unknown';
        }

        const { exists, hasActivePremium } = parsed.data.data;
        if (!exists) return 'missing';

        return hasActivePremium ? 'premium' : 'found';
    } catch (error) {
        // Timeout (`TimeoutError`), blad sieci albo niepoprawny JSON — profil nie moze przez to pasc.
        console.error('Service slug lookup failed, passing request through', error);
        return 'unknown';
    }
}
