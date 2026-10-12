import type { DraftPin } from '@/lib/add-business/types';
import { MAPBOX_PUBLIC_TOKEN } from '@/lib/mapbox';

/**
 * Statyczny obraz Mapbox dla pinu podgladu (D10) — bez mapbox-gl w tym flow.
 */

const STYLE = 'mapbox/streets-v12';
/** Kolor obramowania rozwinietej karty (`border-[#C52289]`), zeby pin pasowal do karty. */
const PIN_COLOR = 'c52289';

export const STATIC_MAP_WIDTH = 600;
export const STATIC_MAP_HEIGHT = 240;

/** Pin przyblizony (ulica/miasto) — szerszy kadr, zeby nie udawac dokladnosci. */
const EXACT_ZOOM = 16;
const APPROXIMATE_ZOOM = 13;
const COORDINATE_DECIMALS = 5;

export function staticMapUrl(pin: DraftPin): string {
    const lng = pin.lng.toFixed(COORDINATE_DECIMALS);
    const lat = pin.lat.toFixed(COORDINATE_DECIMALS);
    const zoom = pin.approximate ? APPROXIMATE_ZOOM : EXACT_ZOOM;
    const overlay = `pin-l+${PIN_COLOR}(${lng},${lat})`;
    const size = `${STATIC_MAP_WIDTH}x${STATIC_MAP_HEIGHT}@2x`;

    return `https://api.mapbox.com/styles/v1/${STYLE}/static/${overlay}/${lng},${lat},${zoom},0/${size}?access_token=${MAPBOX_PUBLIC_TOKEN}`;
}
