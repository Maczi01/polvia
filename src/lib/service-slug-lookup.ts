import { z } from 'zod';

/**
 * Lookup istnienia profilu i aktywnego premium z middleware: `GET /api/service-slug/<slug>`.
 *
 * Wydzielony z `src/middleware.ts` (nie laduje sie w Jescie przez ESM `next-intl/middleware`).
 * Middleware dziala na edge bez bazy, wiec pyta route handler na Node.
 */

/**
 * Lookup blokuje odpowiedz strony, wiec ma twardy limit. Zapytanie to jeden indeksowany
 * SELECT; 1,5 s pokrywa zimny start funkcji, a dluzej nie ma sensu czekac — po timeoucie
 * zadanie i tak przechodzi dalej.
 */
export const SERVICE_SLUG_LOOKUP_TIMEOUT_MS = 1500;

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
}: ServiceSlugLookupOptions): Promise<ServiceSlugLookupResult> {
    try {
        const response = await fetch(`${origin}/api/service-slug/${encodeURIComponent(slug)}`, {
            headers: { [SERVICE_SLUG_LOOKUP_SECRET_HEADER]: secret },
            signal: AbortSignal.timeout(SERVICE_SLUG_LOOKUP_TIMEOUT_MS),
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
