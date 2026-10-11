import 'server-only';

import { type DraftGeo, toDraftGeo } from '@/lib/add-business/draft-store';
import type {
    GeocodeAddress,
    GeocodeOptions,
    GeocodeResult,
    GeoPoint,
} from '@/lib/add-business/geocode';

/** Sygnatura `geocodeAddress` — wstrzykiwana, bo za nia stoi Nominatim. */
export type Geocode = (address: GeocodeAddress, options?: GeocodeOptions) => Promise<GeocodeResult>;

/**
 * Wspolrzedne szkicu albo `null`. Pudlo geokodera nie blokuje szkicu ani wysylki (D3):
 * wlasciciel moze przesunac pin (`relocate`), a operator dostaje flage `missingCoordinates`.
 * Geo trafia do szkicu wylacznie przez `toDraftGeo` — `{ ...result, address }` nie przeszloby
 * walidacji zapisu.
 */
export async function geocodeToDraftGeo(
    geocode: Geocode,
    address: GeocodeAddress,
    knownGeo: GeoPoint | null = null,
): Promise<DraftGeo | null> {
    const result = await geocode(address, { knownGeo });
    if (!result.ok) {
        console.warn('add-business geocode miss', { code: result.code });
        return null;
    }
    return toDraftGeo(result, address);
}
