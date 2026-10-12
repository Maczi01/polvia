import { act } from '@testing-library/react';
import { forwardRef, type JSX, type ReactNode, useImperativeHandle } from 'react';

/**
 * Zamiennik `react-map-gl/mapbox` (WebGL nie dziala w jsdom). Renderuje pinezke jako
 * element z atrybutami `data-lat`/`data-lng` i zapamietuje handlery, zeby test mogl
 * zasymulowac klik w mape albo przeciagniecie pinezki z wlasnymi wspolrzednymi.
 * Uzycie: `jest.mock('react-map-gl/mapbox', () => jest.requireActual('../test-utils/map-gl-mock'))`.
 */

interface LngLatEvent {
    lngLat: { lat: number; lng: number };
}

type Handler = ((event: LngLatEvent) => void) | null;

const handlers: { click: Handler; dragEnd: Handler } = { click: null, dragEnd: null };

export const flyTo = jest.fn();

interface FakeMapProps {
    onClick?: (event: LngLatEvent) => void;
    children?: ReactNode;
}

const FakeMap = forwardRef<{ flyTo: typeof flyTo }, FakeMapProps>(function FakeMap(
    { onClick, children },
    ref,
) {
    useImperativeHandle(ref, () => ({ flyTo }));
    handlers.click = onClick ?? null;
    return <div data-testid="pin-map">{children}</div>;
});

export default FakeMap;

interface FakeMarkerProps {
    latitude: number;
    longitude: number;
    onDragEnd?: (event: LngLatEvent) => void;
}

export function Marker({ latitude, longitude, onDragEnd }: FakeMarkerProps): JSX.Element {
    handlers.dragEnd = onDragEnd ?? null;
    return <div data-testid="map-marker" data-lat={latitude} data-lng={longitude} />;
}

export function NavigationControl(): null {
    return null;
}

export function clickMap(lat: number, lng: number): void {
    act(() => handlers.click?.({ lngLat: { lat, lng } }));
}

export function dragMarker(lat: number, lng: number): void {
    act(() => handlers.dragEnd?.({ lngLat: { lat, lng } }));
}
