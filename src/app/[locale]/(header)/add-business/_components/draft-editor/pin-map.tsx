'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import { type JSX, useEffect, useRef } from 'react';
import Map, {
    type LngLatBoundsLike,
    type MapRef,
    Marker,
    NavigationControl,
} from 'react-map-gl/mapbox';

import { POLAND_BOUNDS } from '@/lib/add-business/form-limits';
import type { DraftPin } from '@/lib/add-business/types';
import { MAPBOX_PUBLIC_TOKEN } from '@/lib/mapbox';

import type { MapPoint } from './use-pin-picker';

/**
 * Interaktywna mapa edytora (C) — ladowana przez `next/dynamic` z `ssr: false` dopiero
 * w kroku edycji (`pin-picker.tsx`), zeby mapbox-gl nie trafial do pierwszego bundla strony.
 */

const POLAND_MAX_BOUNDS: LngLatBoundsLike = [
    [POLAND_BOUNDS.minLng, POLAND_BOUNDS.minLat],
    [POLAND_BOUNDS.maxLng, POLAND_BOUNDS.maxLat],
];

/** Kolor obramowania karty — ten sam co pin statycznego podgladu (`static-map-url.ts`). */
const PIN_COLOR = '#c52289';
/** Pin przyblizony (ulica/miasto) — szerszy kadr, jak w statycznym podgladzie. */
const EXACT_ZOOM = 16;
const APPROXIMATE_ZOOM = 13;

const zoomFor = (pin: DraftPin): number => (pin.approximate ? APPROXIMATE_ZOOM : EXACT_ZOOM);

export interface PinMapProps {
    /** Pin na mapie (reczny albo z wyszukiwania). */
    pin: DraftPin | null;
    /** Wynik wyszukiwania adresu — mapa centruje sie na nim, gdy sie zmieni. */
    focus: DraftPin | null;
    onPick: (point: MapPoint) => void;
}

export function PinMap({ pin, focus, onPick }: PinMapProps): JSX.Element {
    const mapRef = useRef<MapRef>(null);

    useEffect(() => {
        if (focus === null) return;
        mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: zoomFor(focus) });
    }, [focus]);

    return (
        <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_PUBLIC_TOKEN}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            initialViewState={
                focus === null
                    ? { bounds: POLAND_MAX_BOUNDS }
                    : { latitude: focus.lat, longitude: focus.lng, zoom: zoomFor(focus) }
            }
            maxBounds={POLAND_MAX_BOUNDS}
            dragRotate={false}
            touchPitch={false}
            style={{ width: '100%', height: '100%' }}
            onClick={event => onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng })}
        >
            <NavigationControl showCompass={false} />
            {pin !== null && (
                <Marker
                    latitude={pin.lat}
                    longitude={pin.lng}
                    color={PIN_COLOR}
                    draggable
                    onDragEnd={event => onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng })}
                />
            )}
        </Map>
    );
}
