import { getAddressedLocations } from './profile-helpers';
import type { ProfileLocation, ServiceProfileView } from './service-profile-types';

/** Lokalizacje jednego miasta; `city: null` zbiera adresy bez miasta (sama ulica). */
export type CityGroup = {
    city: string | null;
    locations: ProfileLocation[];
};

export type LocationSummary = {
    /** Rozne miasta w kolejnosci `groupLocationsByCity`. */
    cities: string[];
    /** Liczba lokalizacji z adresem. */
    locationCount: number;
};

function toCityKey(location: ProfileLocation): string | null {
    return location.city?.trim() || null;
}

function compareGroups(a: CityGroup, b: CityGroup): number {
    if (a.locations.length !== b.locations.length) {
        return b.locations.length - a.locations.length;
    }
    if (a.city === null) return 1;
    if (b.city === null) return -1;
    return a.city.localeCompare(b.city, 'pl');
}

/**
 * Grupy miast: najpierw miasto pierwszej lokalizacji (glownej — `getAddressedLocations`),
 * potem wedlug liczby lokalizacji malejaco, a przy remisie alfabetycznie. Adresy bez miasta
 * na koncu. W grupie zostaje kolejnosc wejscia, wiec glowna lokalizacja jest pierwsza.
 */
export function groupLocationsByCity(locations: readonly ProfileLocation[]): CityGroup[] {
    const groups = new Map<string | null, CityGroup>();
    for (const location of locations) {
        const city = toCityKey(location);
        const group = groups.get(city);
        if (group) group.locations.push(location);
        else groups.set(city, { city, locations: [location] });
    }

    const [first, ...rest] = [...groups.values()];
    return first ? [first, ...rest.sort(compareGroups)] : [];
}

/** Miasta i liczba lokalizacji do naglowka i tytulu; wpis `online` nie ma zadnych. */
export function getLocationSummary(
    profile: Pick<ServiceProfileView, 'coverage' | 'locations'>,
): LocationSummary {
    const locations = getAddressedLocations(profile);
    const cities = groupLocationsByCity(locations).flatMap(group =>
        group.city ? [group.city] : [],
    );
    return { cities, locationCount: locations.length };
}

/** Najwiecej miast wymienionych w naglowku; reszta jako „i N inne”. */
export const HEADER_MAX_CITIES = 3;

/** Powyzej tylu adresow lista lokalizacji zwija reszte pod `<details>`. */
export const VISIBLE_LOCATIONS_LIMIT = 4;

/**
 * Podzial grup na widoczne i zwiniete: cale miasta, dopoki suma adresow nie przekroczy
 * `VISIBLE_LOCATIONS_LIMIT` (zawsze co najmniej pierwsza grupa). Do limitu — bez zwijania.
 */
export function splitVisibleGroups(groups: readonly CityGroup[]): {
    visible: CityGroup[];
    hidden: CityGroup[];
} {
    const total = groups.reduce((sum, group) => sum + group.locations.length, 0);
    if (total <= VISIBLE_LOCATIONS_LIMIT) return { visible: [...groups], hidden: [] };

    let shown = 0;
    let visibleCount = 0;
    for (const group of groups) {
        const next = shown + group.locations.length;
        if (visibleCount > 0 && next > VISIBLE_LOCATIONS_LIMIT) break;
        shown = next;
        visibleCount += 1;
    }
    return { visible: groups.slice(0, visibleCount), hidden: groups.slice(visibleCount) };
}

/** Wiecej niz jeden adres: sekcje profilu mowia wtedy, ze dotycza siedziby glownej. */
export function hasMultipleLocations(
    profile: Pick<ServiceProfileView, 'coverage' | 'locations'>,
): boolean {
    return getAddressedLocations(profile).length > 1;
}
