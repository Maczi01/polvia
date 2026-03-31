'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PartialService } from '@/types';
import {
    OverviewMap,
    PopupMarkerData,
} from '@/app/[locale]/(main)/_components/overview-map/overview-map';
import { calculateServicesBounds } from '@/lib/map-utils';
import { LngLatBoundsLike } from 'mapbox-gl';

type DirectoryMapClientProps = {
    services: PartialService[];
    highlightedServiceId?: string;
    locale: string;
};

export function DirectoryMapClient({
    services,
    highlightedServiceId,
    locale,
}: DirectoryMapClientProps) {
    const mapRef = useRef<MapRef>(null);
    const [popup, setPopup] = useState<PopupMarkerData | null>(null);
    const [selectedService, setSelectedService] = useState<PartialService | null>(null);
    const hasFittedBounds = useRef(false);

    // Fit bounds on mount
    useEffect(() => {
        if (hasFittedBounds.current || !mapRef.current || services.length === 0) return;

        const fitInitialBounds = () => {
            const map = mapRef.current;
            if (!map) return;

            if (highlightedServiceId) {
                const main = services.find(s => s.id === highlightedServiceId);
                if (main) {
                    setSelectedService(main);
                    map.flyTo({
                        center: [main.longitude, main.latitude],
                        zoom: 14,
                        duration: 1000,
                    });
                    setTimeout(() => {
                        setPopup({
                            id: main.id,
                            name: main.name,
                            latitude: main.latitude,
                            longitude: main.longitude,
                            image: main.image
                                ? `/services/${main.image.trimEnd()}`
                                : '/default.png',
                            place: main.city ?? '',
                            category: main.category,
                        });
                    }, 1200);
                    hasFittedBounds.current = true;
                    return;
                }
            }

            const bounds = calculateServicesBounds(services) as LngLatBoundsLike;
            if (bounds) {
                map.fitBounds(bounds, {
                    duration: 1000,
                    padding: { top: 50, bottom: 50, left: 50, right: 50 },
                });
            }
            hasFittedBounds.current = true;
        };

        // Delay to let the map fully initialize
        const timeout = setTimeout(fitInitialBounds, 500);
        return () => clearTimeout(timeout);
    }, [services, highlightedServiceId]);

    const handleClickedPlace = useCallback(
        (id: string) => {
            const service = services.find(s => s.id === id);
            if (!service) return;
            setSelectedService(service);

            // Navigate to profile page
            const href =
                locale === 'pl'
                    ? `/firma/${service.slug}`
                    : `/${locale}/firma/${service.slug}`;
            window.location.href = href;
        },
        [services, locale],
    );

    const handleOpenPopup = useCallback(
        (popupData: PopupMarkerData) => {
            if (!mapRef.current) return;

            setPopup(popupData);

            const map = mapRef.current.getMap();
            map.stop();
            map.easeTo({
                center: [popupData.longitude, popupData.latitude],
                speed: 0.5,
            });
        },
        [],
    );

    const resetMap = useCallback(() => {
        setPopup(null);
        setSelectedService(null);

        if (!mapRef.current || services.length === 0) return;

        if (highlightedServiceId) {
            const main = services.find(s => s.id === highlightedServiceId);
            if (main) {
                mapRef.current.flyTo({
                    center: [main.longitude, main.latitude],
                    zoom: 14,
                    duration: 1000,
                });
                return;
            }
        }

        const bounds = calculateServicesBounds(services) as LngLatBoundsLike;
        if (bounds) {
            mapRef.current.fitBounds(bounds, {
                duration: 1000,
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
            });
        }
    }, [services, highlightedServiceId]);

    const scrollToTop = useCallback(() => {}, []);

    return (
        <div className="size-full relative">
            <div className="absolute inset-0">
                <OverviewMap
                    ref={mapRef}
                    services={services}
                    selectedService={selectedService}
                    resetMap={resetMap}
                    handleClickedPlace={handleClickedPlace}
                    scrollToTop={scrollToTop}
                    popup={popup}
                    setPopup={setPopup}
                    handleOpenPopup={handleOpenPopup}
                />
            </div>
        </div>
    );
}
