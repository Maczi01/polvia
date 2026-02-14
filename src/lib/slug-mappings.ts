/**
 * Slug mappings for map routes
 * Provides bidirectional lookups between category/county names and URL slugs
 */

import type { Locale } from '@/i18n/config';

// Category name constants (normalized keys used internally)
export const CATEGORY_KEYS = [
    'grocery',
    'transport',
    'financial',
    'renovation',
    'law',
    'beauty',
    'government',
    'health',
    'mechanics',
    'entertainment',
    'education',
    'others',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

// Category slug mappings by locale
export const CATEGORY_SLUGS = {
    pl: {
        grocery: 'spozywcze',
        transport: 'transport',
        financial: 'finansowe',
        renovation: 'remonty',
        law: 'prawne',
        beauty: 'uroda',
        government: 'urzedowe',
        health: 'zdrowie',
        mechanics: 'mechanik',
        entertainment: 'rozrywka',
        education: 'edukacja',
        others: 'inne',
    },
    en: {
        grocery: 'grocery',
        transport: 'transport',
        financial: 'financial',
        renovation: 'renovation',
        law: 'law',
        beauty: 'beauty',
        government: 'government',
        health: 'health',
        mechanics: 'mechanics',
        entertainment: 'entertainment',
        education: 'education',
        others: 'others',
    },
    ru: {
        grocery: 'produkty',
        transport: 'transport',
        financial: 'finansovye',
        renovation: 'remont',
        law: 'pravovye',
        beauty: 'krasota',
        government: 'gosuslugi',
        health: 'zdorovye',
        mechanics: 'mehanik',
        entertainment: 'razvlecheniya',
        education: 'obrazovanie',
        others: 'drugoe',
    },
    uk: {
        grocery: 'produkty',
        transport: 'transport',
        financial: 'finansovi',
        renovation: 'remont',
        law: 'pravovi',
        beauty: 'krasa',
        government: 'derzhavni',
        health: 'zdorovya',
        mechanics: 'mehanik',
        entertainment: 'rozvagy',
        education: 'osvita',
        others: 'inshe',
    },
} as const;

// County slugs (same across all locales, kebab-case)
export const COUNTY_SLUGS = [
    // Northern Ireland
    'antrim',
    'armagh',
    'derry',
    'down',
    'fermanagh',
    'tyrone',
    // Republic of Ireland
    'carlow',
    'cavan',
    'clare',
    'cork',
    'donegal',
    'dublin',
    'galway',
    'kerry',
    'kildare',
    'kilkenny',
    'laois',
    'leitrim',
    'limerick',
    'longford',
    'louth',
    'mayo',
    'meath',
    'monaghan',
    'offaly',
    'roscommon',
    'sligo',
    'tipperary',
    'waterford',
    'westmeath',
    'wexford',
    'wicklow',
] as const;

export type CountySlug = (typeof COUNTY_SLUGS)[number];

// Reverse lookup maps (built at runtime for performance)
const reverseCategoryMaps = {
    pl: null as Record<string, CategoryKey> | null,
    en: null as Record<string, CategoryKey> | null,
    ru: null as Record<string, CategoryKey> | null,
    uk: null as Record<string, CategoryKey> | null,
};

function buildReverseCategoryMap(locale: Locale): Record<string, CategoryKey> {
    if (reverseCategoryMaps[locale]) {
        return reverseCategoryMaps[locale]!;
    }

    const map: Record<string, CategoryKey> = {};
    for (const [key, slug] of Object.entries(CATEGORY_SLUGS[locale])) {
        map[slug] = key as CategoryKey;
    }

    reverseCategoryMaps[locale] = map;
    return map;
}

/**
 * Get category key from a slug
 * @param slug - URL slug (e.g., "spozywcze" or "grocery")
 * @param locale - Current locale
 * @returns Category key or null if invalid
 */
export function getCategoryFromSlug(slug: string, locale: Locale): CategoryKey | null {
    const reverseMap = buildReverseCategoryMap(locale);
    return reverseMap[slug.toLowerCase()] || null;
}

/**
 * Get slug from a category key
 * @param category - Category key (e.g., "grocery")
 * @param locale - Current locale
 * @returns URL slug or null if invalid
 */
export function getSlugFromCategory(category: string, locale: Locale): string | null {
    const normalizedCategory = category.toLowerCase() as CategoryKey;
    return CATEGORY_SLUGS[locale][normalizedCategory] || null;
}

/**
 * Validate if a string is a valid county slug
 * @param slug - Potential county slug
 * @returns True if valid county slug
 */
export function isValidCountySlug(slug: string): slug is CountySlug {
    return COUNTY_SLUGS.includes(slug.toLowerCase() as CountySlug);
}

/**
 * Normalize a county name to its slug format
 * @param county - County name (e.g., "Down", "Dublin")
 * @returns Normalized slug (lowercase)
 */
export function normalizeCountySlug(county: string): string {
    return county.toLowerCase().trim();
}

/**
 * Validate if a string is a valid category key
 * @param category - Potential category key
 * @returns True if valid category key
 */
export function isValidCategoryKey(category: string): category is CategoryKey {
    return CATEGORY_KEYS.includes(category.toLowerCase() as CategoryKey);
}

/**
 * Get all valid category slugs for a locale
 * @param locale - Current locale
 * @returns Array of all category slugs
 */
export function getAllCategorySlugs(locale: Locale): string[] {
    return Object.values(CATEGORY_SLUGS[locale]);
}

/**
 * Get all valid county slugs
 * @returns Array of all county slugs
 */
export function getAllCountySlugs(): readonly CountySlug[] {
    return COUNTY_SLUGS;
}
