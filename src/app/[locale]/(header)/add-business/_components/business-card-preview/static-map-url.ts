import type { DraftPin } from '@/lib/add-business/types';
import { buildStaticMapUrl } from '@/lib/static-map-url';

/**
 * Statyczny obraz Mapbox dla pinu podgladu (D10) — bez mapbox-gl w tym flow.
 * Kolor pinu (`c52289`) pasuje do obramowania rozwinietej karty.
 */

export const STATIC_MAP_WIDTH = 600;
export const STATIC_MAP_HEIGHT = 240;

/** Pin przyblizony (ulica/miasto) — szerszy kadr, zeby nie udawac dokladnosci. */
const EXACT_ZOOM = 16;
const APPROXIMATE_ZOOM = 13;

export function staticMapUrl(pin: DraftPin): string {
    return buildStaticMapUrl({
        pins: [{ lat: pin.lat, lng: pin.lng }],
        width: STATIC_MAP_WIDTH,
        height: STATIC_MAP_HEIGHT,
        zoom: pin.approximate ? APPROXIMATE_ZOOM : EXACT_ZOOM,
    });
}
