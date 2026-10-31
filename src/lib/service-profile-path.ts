import { type Locale, locales } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { localePathPrefix } from '@/lib/map-url-builder';

export { isValidServiceSlug } from '@/lib/service-slug-format';

/**
 * Sciezki profilu firmy `/firma/<slug>` — czysta logika dla middleware i sitemapy.
 *
 * Wydzielone z `src/middleware.ts`, bo tamten modul importuje `next-intl/middleware`
 * (ESM), ktorego nie da sie zaimportowac w tescie jednostkowym. Wzorzec: `map-pathname.ts`.
 */

/** Segment profilu — ten sam we wszystkich locale (`/firma/x`, `/uk/firma/x`). */
export const SERVICE_PROFILE_SEGMENT = 'firma';

export type ServiceProfilePathname = {
    locale: Locale;
    /** Surowy segment z adresu — format sprawdza `isValidServiceSlug`. */
    slug: string;
};

const LOCALE_SET: ReadonlySet<string> = new Set(locales);

function isLocale(value: string): value is Locale {
    return LOCALE_SET.has(value);
}

/**
 * Locale i slug z adresu profilu albo `null`, gdy sciezka nie jest profilem.
 *
 * `/firma/<slug>` to `pl` (domyslny, bez prefiksu), `/{locale}/firma/<slug>` —
 * pozostale. Dokladnie jeden segment slugu: `/firma`, `/firma/` i `/firma/a/b` daja `null`.
 */
export function parseServiceProfilePathname(pathname: string): ServiceProfilePathname | null {
    const segments = pathname.split('/').slice(1);

    if (segments.length === 2 && segments[0] === SERVICE_PROFILE_SEGMENT && segments[1] !== '') {
        return { locale: 'pl', slug: segments[1] };
    }

    if (segments.length !== 3) return null;

    const [locale, segment, slug] = segments;
    if (!isLocale(locale) || segment !== SERVICE_PROFILE_SEGMENT || slug === '') return null;

    return { locale, slug };
}

/** Sciezka profilu w danym locale: `/firma/x` dla `pl`, `/{locale}/firma/x` dla reszty. */
export function buildServiceProfilePath(locale: Locale, slug: string): string {
    return `${localePathPrefix(locale)}/${SERVICE_PROFILE_SEGMENT}/${slug}`;
}

/**
 * Cel rewrite'u w middleware dla profilu, ktory nie istnieje: wewnetrzna sciezka, ktorej
 * nie dopasuje zadna trasa (o segment glebiej niz `[locale]/firma/[slug]`, a segmenty
 * z `_` sa w App Routerze prywatne). Router zwraca wtedy 404 i globalne not-found, zanim
 * zacznie streamowac layout `[locale]` — `notFound()` w `page.tsx` dalby soft-404 (200).
 */
export const SERVICE_PROFILE_NOT_FOUND_PATH = `/pl/${SERVICE_PROFILE_SEGMENT}/_brak-profilu/_404`;

/** Pierwsze segmenty wszystkich tras next-intl, we wszystkich wersjach jezykowych. */
function routingRootSegments(): string[] {
    return Object.entries(routing.pathnames).flatMap(([internal, localized]) => {
        const paths = typeof localized === 'string' ? [localized] : Object.values(localized);
        return [internal, ...paths].map(path => path.split('/')[1]).filter(Boolean);
    });
}

/**
 * Segmenty spoza `routing.pathnames`, ktore zyja w korzeniu domeny:
 * - trasy Next poza next-intl i pliki specjalne,
 * - zrodla i cele przekierowan z `next.config.ts` (`/year`, `/month`, `/privacy`),
 * - katalogi top-level z `public/`.
 * Pliki z kropka (`favicon.ico`, `robots.txt`) i tak nie maja formatu slugu.
 */
const STATIC_RESERVED_SEGMENTS = [
    'api',
    'action',
    'thanks',
    '_next',
    '_vercel',
    'robots.txt',
    'sitemap.xml',
    'year',
    'month',
    'privacy',
    'buttons',
    'categoryCard',
    'icons',
    'images',
    'logo',
    'markers',
    'serviceImages',
    'services',
];

const RESERVED_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
    ...locales,
    ...routingRootSegments(),
    ...STATIC_RESERVED_SEGMENTS,
]);

/**
 * Czy pierwszy segment sciezki jest zajety przez istniejaca trase, locale,
 * przekierowanie albo katalog `public/`. Krotki adres `polvia.pl/<slug>` (U10)
 * nie moze takiego segmentu przechwycic.
 */
export function isReservedRootSegment(segment: string): boolean {
    return RESERVED_ROOT_SEGMENTS.has(segment);
}
