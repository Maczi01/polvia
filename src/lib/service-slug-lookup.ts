import { z } from 'zod';

/**
 * Lookup istnienia profilu z middleware: `GET /api/service-slug/<slug>`.
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
 * - `found` / `missing` — handler odpowiedzial poprawnie,
 * - `unknown` — timeout, blad sieci, status inny niz 2xx albo odpowiedz w zlym ksztalcie.
 *   Wolajacy przepuszcza wtedy zadanie (fail-open), zamiast blokowac profil.
 */
export type ServiceSlugLookupResult = 'found' | 'missing' | 'unknown';

export interface ServiceSlugLookupOptions {
    /** `request.nextUrl.origin` — lookup idzie do tej samej aplikacji. */
    origin: string;
    /** Slug po walidacji formatu (`isValidServiceSlug`). */
    slug: string;
    /** `x-forwarded-for` z zadania klienta: limit w handlerze liczy sie per klient, nie per serwer. */
    forwardedFor: string | null;
}

const lookupResponseSchema = z.object({ data: z.object({ exists: z.boolean() }) });

export async function lookupServiceSlug({
    origin,
    slug,
    forwardedFor,
}: ServiceSlugLookupOptions): Promise<ServiceSlugLookupResult> {
    const headers = new Headers();
    if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

    try {
        const response = await fetch(`${origin}/api/service-slug/${encodeURIComponent(slug)}`, {
            headers,
            cache: 'no-store',
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

        return parsed.data.data.exists ? 'found' : 'missing';
    } catch (error) {
        // Timeout (`TimeoutError`), blad sieci albo niepoprawny JSON — profil nie moze przez to pasc.
        console.error('Service slug lookup failed, passing request through', error);
        return 'unknown';
    }
}
