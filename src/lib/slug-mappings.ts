/**
 * Slug mappings for map routes
 * Provides bidirectional lookups between category/county names and URL slugs
 */

import type { Locale } from '@/i18n/config';

// Category name constants (normalized keys used internally)
export const CATEGORY_KEYS = [
    'grocery',
    'gastronomy',
    'transport',
    'financial',
    'renovation',
    'law',
    'beauty',
    'government',
    'health',
    'mechanics',
    'real_estate',
    'help_support',
    'education',
    'others',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

// Category slug mappings by locale
export const CATEGORY_SLUGS = {
    pl: {
        grocery: 'spozywcze',
        gastronomy: 'gastronomia',
        transport: 'transport',
        financial: 'finansowe',
        renovation: 'remonty',
        law: 'prawne',
        beauty: 'uroda',
        government: 'urzedowe',
        health: 'zdrowie',
        mechanics: 'mechanik',
        real_estate: 'nieruchomosci',
        help_support: 'pomoc-i-wsparcie',
        education: 'edukacja',
        others: 'inne',
    },
    en: {
        grocery: 'grocery',
        gastronomy: 'gastronomy',
        transport: 'transport',
        financial: 'financial',
        renovation: 'renovation',
        law: 'law',
        beauty: 'beauty',
        government: 'government',
        health: 'health',
        mechanics: 'mechanics',
        real_estate: 'real-estate',
        help_support: 'help-support',
        education: 'education',
        others: 'others',
    },
    ru: {
        grocery: 'produkty',
        gastronomy: 'gastronomiya',
        transport: 'transport',
        financial: 'finansovye',
        renovation: 'remont',
        law: 'pravovye',
        beauty: 'krasota',
        government: 'gosuslugi',
        health: 'zdorovye',
        mechanics: 'mehanik',
        real_estate: 'nedvizhimost',
        help_support: 'pomoshch-i-podderzhka',
        education: 'obrazovanie',
        others: 'drugoe',
    },
    uk: {
        grocery: 'produkty',
        gastronomy: 'gastronomiya',
        transport: 'transport',
        financial: 'finansovi',
        renovation: 'remont',
        law: 'pravovi',
        beauty: 'krasa',
        government: 'derzhavni',
        health: 'zdorovya',
        mechanics: 'mehanik',
        real_estate: 'nerukhomist',
        help_support: 'dopomoha-ta-pidtrymka',
        education: 'osvita',
        others: 'inshe',
    },
} as const;

// County slugs (same across all locales, kebab-case)
export const COUNTY_SLUGS = [
    'dolnoslaskie',
    'kujawsko-pomorskie',
    'lubelskie',
    'lubuskie',
    'lodzkie',
    'malopolskie',
    'mazowieckie',
    'opolskie',
    'podkarpackie',
    'podlaskie',
    'pomorskie',
    'slaskie',
    'swietokrzyskie',
    'warminsko-mazurskie',
    'wielkopolskie',
    'zachodniopomorskie',
] as const;

export type CountySlug = (typeof COUNTY_SLUGS)[number];

export type CitySlug = 'warszawa' | 'krakow' | 'lodz' | 'wroclaw' | 'poznan' | 'gdansk' | 'szczecin';

// City dictionary with locale-aware display names and raw DB value matching
export const CITIES: Record<CitySlug, {
    voivodeship: CountySlug;
    names: Record<Locale, string>;
    rawMatches: string[];
}> = {
    warszawa: {
        voivodeship: 'mazowieckie',
        names: { pl: 'Warszawa', en: 'Warsaw', ru: 'Варшава', uk: 'Варшава' },
        rawMatches: ['Warszawa', 'warszawa', 'Warsaw'],
    },
    krakow: {
        voivodeship: 'malopolskie',
        names: { pl: 'Kraków', en: 'Krakow', ru: 'Краков', uk: 'Краків' },
        rawMatches: ['Kraków', 'kraków', 'Krakow', 'krakow'],
    },
    lodz: {
        voivodeship: 'lodzkie',
        names: { pl: 'Łódź', en: 'Lodz', ru: 'Лодзь', uk: 'Лодзь' },
        rawMatches: ['Łódź', 'łódź', 'Lodz', 'lodz'],
    },
    wroclaw: {
        voivodeship: 'dolnoslaskie',
        names: { pl: 'Wrocław', en: 'Wroclaw', ru: 'Вроцлав', uk: 'Вроцлав' },
        rawMatches: ['Wrocław', 'wrocław', 'Wroclaw', 'wroclaw'],
    },
    poznan: {
        voivodeship: 'wielkopolskie',
        names: { pl: 'Poznań', en: 'Poznan', ru: 'Познань', uk: 'Познань' },
        rawMatches: ['Poznań', 'poznań', 'Poznan', 'poznan'],
    },
    gdansk: {
        voivodeship: 'pomorskie',
        names: { pl: 'Gdańsk', en: 'Gdansk', ru: 'Гданьск', uk: 'Гданськ' },
        rawMatches: ['Gdańsk', 'gdańsk', 'Gdansk', 'gdansk'],
    },
    szczecin: {
        voivodeship: 'zachodniopomorskie',
        names: { pl: 'Szczecin', en: 'Szczecin', ru: 'Щецин', uk: 'Щецін' },
        rawMatches: ['Szczecin', 'szczecin'],
    },
};

// City slugs (ASCII, no diacritics)
export const CITY_SLUGS = Object.keys(CITIES) as unknown as readonly CitySlug[];

// Backwards-compatible mapping (used by map-slug-parser)
export const CITY_SLUG_TO_NAME: Record<string, string> = Object.fromEntries(
    Object.entries(CITIES).map(([slug, city]) => [slug, city.names.pl.toLowerCase()]),
);

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
 * Strips Polish diacritics and converts to lowercase kebab-case
 * @param county - County name (e.g., "Dolnośląskie", "Kujawsko-Pomorskie")
 * @returns Normalized slug (e.g., "dolnoslaskie", "kujawsko-pomorskie")
 */
export function normalizeCountySlug(county: string): string {
    return county
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036F]/g, '')
        .replace(/\u0142/g, 'l'); // ł → l (not covered by NFD decomposition)
}

/**
 * Validate if a string is a valid category key
 * @param category - Potential category key
 * @returns True if valid category key
 */
// export function isValidCategoryKey(category: string): category is CategoryKey {
//     return CATEGORY_KEYS.includes(category.toLowerCase() as CategoryKey);
// }

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
// export function getAllCountySlugs(): readonly CountySlug[] {
//     return COUNTY_SLUGS;
// }

/**
 * Validate if a string is a valid city slug
 * @param slug - Potential city slug
 * @returns True if valid city slug
 */
export function isValidCitySlug(slug: string): slug is CitySlug {
    return CITY_SLUGS.includes(slug.toLowerCase() as CitySlug);
}

/**
 * Normalize a city name to its slug format
 * Strips Polish diacritics and converts to lowercase
 * @param city - City name (e.g., "Kraków", "Łódź")
 * @returns Normalized slug (e.g., "krakow", "lodz")
 */
export function normalizeCitySlug(city: string): string {
    return city
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036F]/g, '')
        .replace(/\u0142/g, 'l'); // ł → l (not covered by NFD decomposition)
}

/**
 * Get all valid city slugs
 * @returns Array of all city slugs
 */
// export function getAllCitySlugs(): readonly CitySlug[] {
//     return CITY_SLUGS;
// }

/**
 * Get the original city name (with diacritics) from a slug
 * @param slug - City slug (e.g., "krakow")
 * @returns City name with diacritics lowercase (e.g., "kraków") or null if invalid
 */
export function getCityNameFromSlug(slug: string): string | null {
    return CITY_SLUG_TO_NAME[slug.toLowerCase()] || null;
}

/**
 * Get the locale-aware display name for a city
 * @param slug - City slug (e.g., "krakow")
 * @param locale - Current locale
 * @returns Capitalized city name (e.g., "Kraków" for pl, "Krakow" for en) or null
 */
export function getCityDisplayName(slug: string, locale: Locale): string | null {
    const city = CITIES[slug.toLowerCase() as CitySlug];
    return city?.names[locale] ?? null;
}

/**
 * Get the raw DB city values that match a given city slug.
 * Used for SQL WHERE clauses to filter service_locations by city.
 */
export function getCityRawMatches(slug: CitySlug): string[] {
    return CITIES[slug]?.rawMatches ?? [];
}

/**
 * Resolve a raw DB city value to a normalized CitySlug.
 * First tries exact match against known rawMatches, then falls back to slug normalization.
 */
let rawToCitySlugCache: Map<string, CitySlug> | null = null;

function buildRawToCitySlugCache(): Map<string, CitySlug> {
    if (rawToCitySlugCache) return rawToCitySlugCache;
    const map = new Map<string, CitySlug>();
    for (const [slug, city] of Object.entries(CITIES)) {
        for (const raw of city.rawMatches) {
            map.set(raw, slug as CitySlug);
        }
    }
    rawToCitySlugCache = map;
    return map;
}

export function normalizeCityFromRaw(rawCity: string): CitySlug | null {
    const cache = buildRawToCitySlugCache();

    // Exact match against known raw values
    const exactMatch = cache.get(rawCity);
    if (exactMatch) return exactMatch;

    // Fallback: normalize and check if it's a valid city slug
    const normalized = normalizeCitySlug(rawCity);
    if (isValidCitySlug(normalized)) return normalized;

    return null;
}

/**
 * Get the voivodeship for a city slug
 */
export function getCityVoivodeship(slug: CitySlug): CountySlug {
    return CITIES[slug].voivodeship;
}
