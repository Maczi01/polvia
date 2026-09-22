/**
 * Czyste funkcje budujace metadane stron mapy (canonical, hreflang, sufiks tytulu).
 * Wydzielone z `generateMetadata`, zeby dalo sie je testowac bez next-intl.
 */

import type { Locale } from '@/i18n/config';
import type { MapFilters } from '@/lib/map-slug-parser';
import { buildMapUrl, localePathPrefix, localizeMapPath } from '@/lib/map-url-builder';
import { CATEGORY_MESSAGE_KEYS } from '@/lib/slug-mappings';

export type MapMetadataLabels = {
    category: (messageKey: string) => string;
    online: string;
    /** Tlumaczy klucz `MapPage.counties` — wojewodztwa i miasta dziela ten namespace. */
    location: (key: string) => string;
};

/**
 * Pelna, zlokalizowana sciezka strony mapy dla danych filtrow,
 * np. `/mapa/uroda/warszawa` (pl) albo `/uk/map/krasa/warszawa` (uk).
 */
export function buildMapMetadataPath(filters: MapFilters, locale: Locale): string {
    const { category, county, city, onlineOnly } = filters;
    const { pathname } = buildMapUrl({ category, county, city, onlineOnly }, locale);
    return `${localePathPrefix(locale)}${localizeMapPath(pathname, locale)}`;
}

/**
 * Sufiks tytulu, np. ` - Uroda, Warszawa`. Zasieg, wojewodztwo i miasto zajmuja
 * ten sam slot sciezki, wiec w tytule stoja na tej samej pozycji — po kategorii.
 */
export function buildMapTitleSuffix(filters: MapFilters, labels: MapMetadataLabels): string {
    const { category, county, city, onlineOnly } = filters;
    const parts: string[] = [];

    if (category) {
        parts.push(labels.category(CATEGORY_MESSAGE_KEYS[category]));
    }

    if (onlineOnly) {
        parts.push(labels.online);
    } else if (county) {
        parts.push(labels.location(county));
    } else if (city) {
        parts.push(labels.location(city));
    }

    return parts.length > 0 ? ` - ${parts.join(', ')}` : '';
}
