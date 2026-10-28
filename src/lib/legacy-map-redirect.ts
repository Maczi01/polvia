import { type Locale } from '@/i18n/config';
import { extractFiltersFromQueryParams } from '@/lib/map-slug-parser';
import {
    buildMapUrl,
    localePathPrefix,
    localizeMapPath,
    stringifyMapUrl,
} from '@/lib/map-url-builder';

export type MapSearchParams = { [key: string]: string | string[] | undefined };

/** Powtorzony parametr (`?query=a&query=b`) przychodzi jako tablica — bierzemy pierwsza wartosc. */
function firstValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function toView(value: string | undefined): 'map' | 'list' | undefined {
    return value === 'map' || value === 'list' ? value : undefined;
}

/**
 * Cel przekierowania ze starego URL-a opartego na query (`?category=…&county=…`)
 * na URL ze slugami. `null`, gdy URL nie jest w starym formacie.
 */
export function legacyMapRedirectPath(searchParams: MapSearchParams, locale: Locale): string | null {
    if (!searchParams.category && !searchParams.county) return null;

    const oldFilters = extractFiltersFromQueryParams({
        category: searchParams.category,
        county: searchParams.county,
    });

    const newUrl = buildMapUrl(
        {
            category: oldFilters.category,
            county: oldFilters.county,
            query: firstValue(searchParams.query),
            place: firstValue(searchParams.place),
            view: toView(firstValue(searchParams.view)),
        },
        locale,
    );

    // Jezyk obslugi przechodzi bez walidacji — parser `?lang` po stronie klienta
    // i tak zignoruje nieznany kod (R10).
    const lang = firstValue(searchParams.lang);
    if (lang) {
        newUrl.query = { ...newUrl.query, lang };
    }

    return `${localePathPrefix(locale)}${localizeMapPath(stringifyMapUrl(newUrl), locale)}`;
}
