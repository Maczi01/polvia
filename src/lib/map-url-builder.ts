/**
 * URL builder for map routes
 * Generates type-safe URLs with slug-based paths and query parameters
 */

import { getSlugFromCategory, normalizeCountySlug, isValidCountySlug, normalizeCitySlug, isValidCitySlug } from './slug-mappings';
import type { Locale } from '@/i18n/config';

export type MapUrlParams = {
    category?: string | null;
    county?: string | null;
    city?: string | null;
    query?: string | null;
    slug?: string | null;
    view?: 'map' | 'list' | null;
};

export type MapUrl = {
    pathname: string;
    query?: Record<string, string>;
};

/**
 * Builds type-safe map URLs with slug-based paths and query params
 *
 * Examples:
 *   buildMapUrl({ category: 'grocery' }, 'pl')
 *   → { pathname: '/map/spozywcze' }
 *
 *   buildMapUrl({ county: 'down' }, 'pl')
 *   → { pathname: '/map/down' }
 *
 *   buildMapUrl({ category: 'grocery', county: 'down', query: 'sklep' }, 'pl')
 *   → { pathname: '/map/spozywcze/down', query: { query: 'sklep' } }
 *
 * @param params - Filter and query parameters
 * @param locale - Current locale
 * @returns URL object with pathname and optional query params
 */
export function buildMapUrl(params: MapUrlParams, locale: Locale): MapUrl {
    const { category, county, city, query, slug, view } = params;

    // Base pathname
    const basePath = '/map';
    let pathname = basePath;

    // Build slug path
    const slugParts: string[] = [];

    if (category) {
        const categorySlug = getSlugFromCategory(category, locale);
        if (categorySlug) {
            slugParts.push(categorySlug);
        }
    }

    if (county) {
        const countySlug = normalizeCountySlug(county);
        if (isValidCountySlug(countySlug)) {
            slugParts.push(countySlug);
        }
    } else if (city) {
        const citySlug = normalizeCitySlug(city);
        if (isValidCitySlug(citySlug)) {
            slugParts.push(citySlug);
        }
    }

    // Append slug parts to pathname
    if (slugParts.length > 0) {
        pathname = `${basePath}/${slugParts.join('/')}`;
    }

    // Build query parameters
    const queryParams: Record<string, string> = {};

    if (query && query.trim().length > 0) {
        queryParams.query = query.trim();
    }

    if (slug && slug.trim().length > 0) {
        queryParams.slug = slug.trim();
    }

    if (view && (view === 'map' || view === 'list')) {
        queryParams.view = view;
    }

    // Return URL object
    const result: MapUrl = { pathname };

    if (Object.keys(queryParams).length > 0) {
        result.query = queryParams;
    }

    return result;
}

/**
 * Build a simple map URL with just a category filter
 * @param category - Category key
 * @param locale - Current locale
 * @returns URL object
 */
export function buildCategoryUrl(category: string, locale: Locale): MapUrl {
    return buildMapUrl({ category }, locale);
}

/**
 * Build a simple map URL with just a county filter
 * @param county - County slug
 * @param locale - Current locale
 * @returns URL object
 */
export function buildCountyUrl(county: string, locale: Locale): MapUrl {
    return buildMapUrl({ county }, locale);
}

/**
 * Build a map URL for a specific service (by slug)
 * @param slug - Service slug
 * @param locale - Current locale
 * @returns URL object with slug as query param
 */
export function buildServiceUrl(slug: string, locale: Locale): MapUrl {
    return buildMapUrl({ slug }, locale);
}

/**
 * Convert an internal map pathname to a user-facing localized path.
 * Internal paths always use /map/...; PL locale needs /mapa/...
 *
 * Use this for browser URLs (pushState), canonical URLs, redirects, and sitemaps.
 * Do NOT use for next-intl Link hrefs or router.push — those need internal paths.
 *
 * @param pathname - Internal pathname (e.g. '/map/zdrowie')
 * @param locale - Current locale
 * @returns Localized pathname (e.g. '/mapa/zdrowie' for PL, '/map/health' for EN)
 */
export function localizeMapPath(pathname: string, locale: Locale): string {
    if (locale === 'pl') {
        return pathname.replace(/^\/map(?=\/|$)/, '/mapa');
    }
    return pathname;
}

/**
 * Build URL string from MapUrl object
 * Useful for redirects and navigation
 * @param mapUrl - Map URL object
 * @returns Complete URL string
 */
export function stringifyMapUrl(mapUrl: MapUrl): string {
    const { pathname, query } = mapUrl;
    if (!query || Object.keys(query).length === 0) {
        return pathname;
    }

    const queryString = new URLSearchParams(query).toString();
    return `${pathname}?${queryString}`;
}
