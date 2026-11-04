import { MAPBOX_PUBLIC_TOKEN } from '@/lib/mapbox';

/**
 * URL statycznego obrazu Mapbox (Static Images API) — mapa bez mapbox-gl w przegladarce.
 * Uzywaja go podglad pinu przy dodawaniu firmy i mapa na stronie premium.
 */

const STYLE = 'mapbox/streets-v12';
/** Kolor marki (`border-[#C52289]`), ten sam co pin mapy katalogu. */
const PIN_COLOR = 'c52289';
const COORDINATE_DECIMALS = 5;

export type StaticMapPoint = { lat: number; lng: number };

export type StaticMapOptions = {
    /** Co najmniej jeden pin; powtorzone wspolrzedne licza sie jako jeden. */
    pins: readonly [StaticMapPoint, ...StaticMapPoint[]];
    /** Wymiary w punktach CSS (obraz idzie w `@2x`); Mapbox przyjmuje najwyzej 1280. */
    width: number;
    height: number;
    /** Przyblizenie kadru wysrodkowanego na jedynym pinie. */
    zoom: number;
    /** Margines kadru `auto` (kilka pinow) w punktach, zeby piny nie stykaly sie z krawedzia. */
    padding?: number;
};

function toLngLat(point: StaticMapPoint): string {
    return `${point.lng.toFixed(COORDINATE_DECIMALS)},${point.lat.toFixed(COORDINATE_DECIMALS)}`;
}

/**
 * Jeden pin: kadr wysrodkowany na nim z `zoom`. Kilka pinow: kadr `auto` obejmujacy wszystkie.
 * Wspolrzedne zaokraglone do 5 miejsc (~1 m) — tylko cyfry, kropka, minus i przecinek,
 * wiec sciezka nie wymaga kodowania.
 */
export function buildStaticMapUrl({
    pins,
    width,
    height,
    zoom,
    padding,
}: StaticMapOptions): string {
    const coordinates = [...new Set(pins.map(toLngLat))];
    const overlay = coordinates.map(lngLat => `pin-l+${PIN_COLOR}(${lngLat})`).join(',');
    const size = `${width}x${height}@2x`;
    const isSinglePin = coordinates.length === 1;
    const viewport = isSinglePin ? `${coordinates[0]},${zoom},0` : 'auto';
    const query = new URLSearchParams();
    if (!isSinglePin && padding !== undefined) query.set('padding', String(padding));
    query.set('access_token', MAPBOX_PUBLIC_TOKEN);

    return `https://api.mapbox.com/styles/v1/${STYLE}/static/${overlay}/${viewport}/${size}?${query.toString()}`;
}
