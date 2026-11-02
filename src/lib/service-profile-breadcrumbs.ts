import type { Locale } from '@/i18n/config';
import {
    buildMapUrl,
    localePathPrefix,
    localizeMapPath,
    type MapUrlParams,
} from '@/lib/map-url-builder';
import type { JsonLdObject } from '@/lib/service-profile-metadata';
import { buildServiceProfilePath } from '@/lib/service-profile-path';
import { isValidCitySlug, normalizeCitySlug } from '@/lib/slug-mappings';

/**
 * Okruszki profilu firmy: `Polvia › <kategoria> › <miasto> › <nazwa>`. Jedno zrodlo
 * pozycji dla nawigacji na stronie i dla JSON-LD `BreadcrumbList`.
 */

export type ProfileBreadcrumb = {
    label: string;
    /**
     * Sciezka w adresie przegladarki, z prefiksem locale (`/mapa/zdrowie`, `/uk/map/...`),
     * albo `null` — pozycja bez linku. Ostatnia pozycja (profil) nie jest linkiem na
     * stronie, ale jej sciezka trafia do JSON-LD.
     */
    href: string | null;
};

export type ProfileBreadcrumbsInput = {
    locale: Locale;
    siteName: string;
    /** Klucz kategorii (`@/lib/categories`). */
    category: string;
    categoryLabel: string;
    /** Miasto naglowka (`getHeaderCity`); `null` dla wpisu bez punktu obslugi. */
    city: string | null;
    name: string;
    slug: string;
};

/** Strona glowna w danym locale: `/` dla `pl`, `/{locale}` dla reszty. */
export function buildHomePath(locale: Locale): string {
    return localePathPrefix(locale) || '/';
}

/** Sciezka mapy z filtrami w adresie przegladarki (`/mapa/...` dla `pl`, `/{locale}/map/...`). */
function buildLocalizedMapPath(params: MapUrlParams, locale: Locale): string {
    const { pathname } = buildMapUrl(params, locale);
    return `${localePathPrefix(locale)}${localizeMapPath(pathname, locale)}`;
}

/**
 * Pozycje okruszkow. Miasto tylko wtedy, gdy mapa ma dla niego slug (`CITY_SLUGS`) —
 * dla innych miast filtr nie istnieje, a URL przekierowalby na sama mape. Bez linku
 * okruszek miasta nie moglby trafic do `BreadcrumbList`, wiec znika z obu miejsc.
 */
export function buildProfileBreadcrumbs({
    locale,
    siteName,
    category,
    categoryLabel,
    city,
    name,
    slug,
}: ProfileBreadcrumbsInput): ProfileBreadcrumb[] {
    const crumbs: ProfileBreadcrumb[] = [
        { label: siteName, href: buildHomePath(locale) },
        { label: categoryLabel, href: buildLocalizedMapPath({ category }, locale) },
    ];

    const trimmedCity = city?.trim();
    if (trimmedCity && isValidCitySlug(normalizeCitySlug(trimmedCity))) {
        crumbs.push({
            label: trimmedCity,
            href: buildLocalizedMapPath({ category, city: trimmedCity }, locale),
        });
    }

    crumbs.push({ label: name, href: buildServiceProfilePath(locale, slug) });
    return crumbs;
}

/** JSON-LD `BreadcrumbList`: pozycje 1..n, adresy absolutne; pozycja bez sciezki bez `item`. */
export function buildBreadcrumbJsonLd(
    crumbs: readonly ProfileBreadcrumb[],
    baseUrl: string,
): JsonLdObject {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.label,
            ...(crumb.href ? { item: `${baseUrl}${crumb.href}` } : {}),
        })),
    };
}
