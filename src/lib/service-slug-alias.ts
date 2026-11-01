import { locales } from '../i18n/config';
import { routing } from '../i18n/routing';
import { isValidServiceSlug } from './service-slug-format';

/**
 * Czy slug uslugi moze dostac krotki adres `polvia.pl/<slug>` — wspolna regula middleware
 * (ktore sciezki sa kandydatami aliasu) i przydzielacza slugow (`src/db/service-slugs.ts`),
 * ktory nie nadaje slugu bez aliasu obiecanego w `/cennik`.
 *
 * Importy relatywne i bez zoda/drizzle: modul laduje middleware (edge) i skrypty CLI (`tsx`).
 */

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

/**
 * Typowe sciezki skanerow podatnosci bez kropki w nazwie (te z kropka, np. `/.env`
 * i `/wp-login.php`, odpadaja juz na matcherze middleware). Kazda unikalna sciezka
 * w formacie slugu to inaczej wywolanie funkcji Node + SELECT, bo omija cache CDN.
 * Rezerwacja oznacza tez, ze zadna firma nie dostanie takiego slugu.
 */
const SCANNER_SEGMENTS = [
    'admin',
    'administrator',
    'backup',
    'cgi-bin',
    'env',
    'git',
    'phpmyadmin',
    'pma',
    'vendor',
    'wordpress',
    'wp',
    'wp-admin',
    'wp-content',
    'wp-includes',
    'wp-json',
    'wp-login',
    'xmlrpc',
];

const RESERVED_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
    ...locales,
    ...routingRootSegments(),
    ...STATIC_RESERVED_SEGMENTS,
    ...SCANNER_SEGMENTS,
]);

/**
 * Czy pierwszy segment sciezki jest zajety przez istniejaca trase, locale,
 * przekierowanie, katalog `public/` albo typowa sciezke skanera. Krotki adres
 * `polvia.pl/<slug>` nie moze takiego segmentu przechwycic.
 */
export function isReservedRootSegment(segment: string): boolean {
    return RESERVED_ROOT_SEGMENTS.has(segment);
}

/**
 * Czy slug ma format slugu uslugi i nie koliduje z segmentem zarezerwowanym — czyli czy
 * `polvia.pl/<slug>` moze przekierowac na profil.
 *
 * Prefiks `api` (np. `apiary`) jest dozwolony: matcher middleware wyklucza tylko `/api/**`,
 * nie kazda sciezke zaczynajaca sie od `api`.
 */
export function isAliasableServiceSlug(slug: string): boolean {
    return isValidServiceSlug(slug) && !isReservedRootSegment(slug);
}
