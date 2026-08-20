/**
 * Parser for map URL slugs
 * Converts slug arrays from URLs into validated filter objects
 *
 * Clean URL patterns:
 *   /map                      → all services
 *   /map/{county}             → all categories in that county
 *   /map/{category}           → that category across all counties
 *   /map/{category}/{county}  → that category in that county
 */

import {
    getCategoryFromSlug,
    isOnlineSlug,
    isValidCountySlug,
    normalizeCountySlug,
    isValidCitySlug,
    normalizeCitySlug,
    getCityNameFromSlug,
    type CategoryKey,
    type CountySlug,
    type CitySlug,
} from './slug-mappings';
import type { Locale } from '@/i18n/config';

export type MapFilters = {
    category: CategoryKey | null;
    county: CountySlug | null;
    city: string | null;
    /**
     * Zawezenie do uslug o zasiegu zdalnym (`online` i `hybrid`).
     * Zajmuje ten sam slot URL-a co `county` / `city`, wiec jest z nimi
     * wzajemnie wykluczajace — patrz COVERAGE_ONLINE_SLUG.
     */
    onlineOnly: boolean;
};

export type ParseSlugResult =
    | { success: true; filters: MapFilters }
    | { success: false; redirectTo: string };

/**
 * Parses map URL slugs into filter values
 *
 * Examples:
 *   undefined                 → { category: null, county: null }
 *   ['spozywcze']             → { category: 'grocery', county: null }
 *   ['down']                  → { category: null, county: 'down' }
 *   ['spozywcze', 'down']     → { category: 'grocery', county: 'down' }
 *
 * @param slug - Slug array from URL params
 * @param locale - Current locale
 * @param basePath - Base path for redirects (e.g., '/mapa' or '/en/map')
 * @returns Parsed filters or redirect path
 */
export function parseMapSlug(
    slug: string[] | undefined,
    locale: Locale,
    basePath: string = locale === 'pl' ? '/mapa' : '/map',
): ParseSlugResult {
    // No slug means no filters
    if (!slug || slug.length === 0) {
        return {
            success: true,
            filters: { category: null, county: null, city: null, onlineOnly: false },
        };
    }

    // Too many segments - invalid
    if (slug.length > 2) {
        return {
            success: false,
            redirectTo: basePath,
        };
    }

    // Clean and normalize slug segments
    const cleanedSlug = slug.map(s => s.trim().toLowerCase()).filter(s => s.length > 0);

    // Check for empty segments after cleaning
    if (cleanedSlug.length !== slug.length) {
        return {
            success: false,
            redirectTo: basePath,
        };
    }

    // Parse based on slug length
    if (cleanedSlug.length === 1) {
        return parseSingleSegment(cleanedSlug[0], locale, basePath);
    } else {
        // Length is 2: {category}/{county}
        return parseTwoSegments(cleanedSlug[0], cleanedSlug[1], locale, basePath);
    }
}

/**
 * Parse a single slug segment
 * Could be either a category or a county (category checked first)
 */
function parseSingleSegment(
    segment: string,
    locale: Locale,
    basePath: string,
): ParseSlugResult {
    // Try coverage first — jawna kolejnosc; `online` nie koliduje z niczym,
    // ale sprawdzenie przed lokalizacja czyni intencje oczywista.
    if (isOnlineSlug(segment)) {
        return {
            success: true,
            filters: { category: null, county: null, city: null, onlineOnly: true },
        };
    }

    // Try category
    const category = getCategoryFromSlug(segment, locale);
    if (category) {
        return {
            success: true,
            filters: { category, county: null, city: null, onlineOnly: false },
        };
    }

    // Try county
    const normalizedCounty = normalizeCountySlug(segment);
    if (isValidCountySlug(normalizedCounty)) {
        return {
            success: true,
            filters: { category: null, county: normalizedCounty, city: null, onlineOnly: false },
        };
    }

    // Try city
    const normalizedCity = normalizeCitySlug(segment);
    if (isValidCitySlug(normalizedCity)) {
        return {
            success: true,
            filters: {
                category: null,
                county: null,
                city: getCityNameFromSlug(normalizedCity),
                onlineOnly: false,
            },
        };
    }

    // Invalid slug
    return {
        success: false,
        redirectTo: basePath,
    };
}

/**
 * Parse two slug segments
 * Format: [category, county|city]
 * First segment MUST be a valid category, second MUST be a valid county or city
 */
function parseTwoSegments(
    first: string,
    second: string,
    locale: Locale,
    basePath: string,
): ParseSlugResult {
    // First segment: must be a category
    const category = getCategoryFromSlug(first, locale);
    if (!category) {
        return {
            success: false,
            redirectTo: basePath,
        };
    }

    // Second segment: coverage, then county, then city.
    // `/mapa/{wojewodztwo}/online` odpada samo — pierwszy segment musi byc
    // kategoria, wiec NIE dopisujemy tu osobnej reguly odrzucania.
    if (isOnlineSlug(second)) {
        return {
            success: true,
            filters: { category, county: null, city: null, onlineOnly: true },
        };
    }

    const normalizedCounty = normalizeCountySlug(second);
    if (isValidCountySlug(normalizedCounty)) {
        return {
            success: true,
            filters: { category, county: normalizedCounty, city: null, onlineOnly: false },
        };
    }

    const normalizedCity = normalizeCitySlug(second);
    if (isValidCitySlug(normalizedCity)) {
        return {
            success: true,
            filters: {
                category,
                county: null,
                city: getCityNameFromSlug(normalizedCity),
                onlineOnly: false,
            },
        };
    }

    return {
        success: false,
        redirectTo: basePath,
    };
}

/**
 * Helper to extract filter parameters from old query-based URLs
 * Used for redirect logic from old URLs to new slug-based URLs
 */
export function extractFiltersFromQueryParams(params: {
    category?: string | string[];
    county?: string | string[];
}): { category: string | null; county: string | null } {
    const category = Array.isArray(params.category)
        ? params.category[0]
        : params.category || null;

    const county = Array.isArray(params.county) ? params.county[0] : params.county || null;

    return {
        category: category ? category.toLowerCase().trim() : null,
        county: county ? county.toLowerCase().trim() : null,
    };
}
