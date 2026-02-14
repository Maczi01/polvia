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
    isValidCountySlug,
    normalizeCountySlug,
    type CategoryKey,
    type CountySlug,
} from './slug-mappings';

export type MapFilters = {
    category: CategoryKey | null;
    county: CountySlug | null;
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
    locale: 'pl' | 'en',
    basePath: string = locale === 'pl' ? '/mapa' : '/map',
): ParseSlugResult {
    // No slug means no filters
    if (!slug || slug.length === 0) {
        return {
            success: true,
            filters: { category: null, county: null },
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
    locale: 'pl' | 'en',
    basePath: string,
): ParseSlugResult {
    // Try category first
    const category = getCategoryFromSlug(segment, locale);
    if (category) {
        return {
            success: true,
            filters: { category, county: null },
        };
    }

    // Try county
    const normalizedCounty = normalizeCountySlug(segment);
    if (isValidCountySlug(normalizedCounty)) {
        return {
            success: true,
            filters: { category: null, county: normalizedCounty },
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
 * Format: [category, county]
 * First segment MUST be a valid category, second MUST be a valid county
 */
function parseTwoSegments(
    first: string,
    second: string,
    locale: 'pl' | 'en',
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

    // Second segment: must be a county
    const normalizedCounty = normalizeCountySlug(second);
    if (!isValidCountySlug(normalizedCounty)) {
        return {
            success: false,
            redirectTo: basePath,
        };
    }

    return {
        success: true,
        filters: { category, county: normalizedCounty },
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
