import type { Locale } from '@/i18n/config';
import { localePathPrefix } from '@/lib/map-url-builder';
import { isAliasableServiceSlug } from '@/lib/service-slug-alias';
import type { ServiceSlugLookupResult } from '@/lib/service-slug-lookup';
import { splitLocalePrefix } from '@/lib/split-locale-prefix';

export { isReservedRootSegment } from '@/lib/service-slug-alias';
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

/**
 * Locale i slug z adresu profilu albo `null`, gdy sciezka nie jest profilem.
 *
 * `/firma/<slug>` to `pl` (domyslny, bez prefiksu), `/{locale}/firma/<slug>` —
 * pozostale. Dokladnie jeden segment slugu: `/firma`, `/firma/` i `/firma/a/b` daja `null`.
 */
export function parseServiceProfilePathname(pathname: string): ServiceProfilePathname | null {
    const { locale, segments } = splitLocalePrefix(pathname);
    if (segments.length !== 2) return null;

    const [segment, slug] = segments;
    if (segment !== SERVICE_PROFILE_SEGMENT || slug === '') return null;

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

/** Segmenty strony powrotu ze Stripe Checkout pod profilem: `/firma/<slug>/premium/dziekujemy`. */
const PREMIUM_THANKS_SEGMENTS = ['premium', 'dziekujemy'] as const;

/**
 * Czy sciezka to strona powrotu ze Stripe Checkout (`/firma/<slug>/premium/dziekujemy`,
 * w kazdym locale, z dowolnym slugiem). Bez konfiguracji Stripe middleware odpowiada na nia
 * prawdziwym 404 — `notFound()` w streamowanej stronie dalby soft-404 (200).
 */
export function isPremiumThanksPathname(pathname: string): boolean {
    const { segments } = splitLocalePrefix(pathname);
    if (segments.length !== 4) return false;

    const [segment, slug, ...rest] = segments;
    return (
        segment === SERVICE_PROFILE_SEGMENT &&
        slug !== '' &&
        rest[0] === PREMIUM_THANKS_SEGMENTS[0] &&
        rest[1] === PREMIUM_THANKS_SEGMENTS[1]
    );
}

/**
 * Slug krotkiego adresu `polvia.pl/<slug>` albo `null`, gdy sciezka nim nie jest.
 *
 * Kandydat to dokladnie jeden segment bez prefiksu locale (alias istnieje tylko w `pl`),
 * spelniajacy `isAliasableServiceSlug` (format slugu, poza segmentami zarezerwowanymi).
 * Dzieki temu lookup dostaja tylko sciezki, ktore bez aliasu i tak skonczylyby sie 404 —
 * istniejace strony nie zwalniaja.
 * Pliki (`/robots.txt`, `/favicon.ico`) odpadaja na formacie: kropka nie jest w slugu.
 */
export function parseRootAliasPathname(pathname: string): string | null {
    const segments = pathname.split('/').slice(1);
    if (segments.length !== 1) return null;

    const [slug] = segments;
    if (!isAliasableServiceSlug(slug)) return null;

    return slug;
}

/**
 * Cel przekierowania krotkiego adresu: profil `pl`, ale tylko dla aktywnego premium.
 * Brak premium, brak wpisu i awaria lookupu (`unknown`) daja `null` — zadanie idzie
 * dalej bez zmian i konczy sie 404 next-intl, jak przed wprowadzeniem aliasu.
 */
export function rootAliasRedirectPath(slug: string, lookup: ServiceSlugLookupResult): string | null {
    return lookup === 'premium' ? buildServiceProfilePath('pl', slug) : null;
}
