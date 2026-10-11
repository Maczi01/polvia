import type { DraftPin } from '@/lib/add-business/types';

/**
 * Statyczny obraz Mapbox dla pinu podgladu (D10) — bez mapbox-gl w tym flow.
 *
 * Token: ten sam publiczny `pk.`, ktory `overview-map.tsx` ma wpisany na sztywno (nie ma
 * go w `env.ts`). Token publiczny z natury trafia do przegladarki.
 */
export const MAPBOX_PUBLIC_TOKEN =
    'pk.eyJ1IjoiaGlqaWFuZ3RhbyIsImEiOiJjampxcjFnb3E2NTB5M3BvM253ZHV5YjhjIn0.WneUon5qFigfJRJ3oaZ3Ow';

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
