import { forwardRef, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BBox } from 'geojson';
import { MapRef } from 'react-map-gl/mapbox';
import { Coordinates, MarkerData, MarkerDataCluster, PartialService } from '@/types';
import useSupercluster from 'use-supercluster';
import { MarkerPopup } from '../marker-popup';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { ClusterPopup } from '../cluster-popup';
import { createPoints, initialViewState, mapFeature, reduceCluster } from './utility';
import { Marker } from './marker';
import MapNoSsr from './map-no-ssr';
import { ControlButtons } from './control-buttons';
import { Cluster } from '../cluster';
import { ResetButton } from './reset-button';
import { useRouter } from '@/i18n/navigation';
import { useTheme } from 'next-themes';
import { MapControls } from '@/app/[locale]/(main)/_components/overview-map/map-controls';

type OverviewMapProps = {
    services: PartialService[];
    selectedService: PartialService | null;
    resetMap: () => void;
    handleClickedPlace: (id: number) => void;
    scrollToTop: () => void;
    popup: PopupMarkerData | null;
    setPopup: (popup: PopupMarkerData | null) => void;
    handleOpenPopup?: (popup: PopupMarkerData) => void;
};

export type PopupMarkerData = MarkerData & { id: number };

// Utility function to throttle function calls
const throttle = <T extends (...args: any[]) => void>(func: T, limit: number): T => {
    let inThrottle: boolean;
    return ((...args: any[]) => {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }) as T;
};

export const OverviewMap = forwardRef<MapRef, OverviewMapProps>(
    ({
         services,
         selectedService,
         resetMap,
         handleClickedPlace,
         scrollToTop,
         handleOpenPopup,
         popup,
         setPopup
     }, externalRef) => {
        const [bounds, setBounds] = useState<BBox>([-180, -85, 180, 85]);
        const [zoom, setZoom] = useState<number>(initialViewState.zoom);
        const [mounted, setMounted] = useState(false);
        const router = useRouter();
        const [popupFlag, setPopupFlag] = useState(true);
        const [popupCluster, setPopupCluster] = useState<MarkerDataCluster | null>(null);
        const { theme, resolvedTheme } = useTheme();
        const [isZoomingToMarker, setIsZoomingToMarker] = useState(false);

        const containerRef = useRef<HTMLDivElement>(null);
        const mapRef = externalRef as RefObject<MapRef | null>;
        const previousSelectedCellName = useRef('');
        const isMobile = useIsMobile({ breakpoint: 768 });

        // Initialize mounted state
        useEffect(() => {
            setMounted(true);
        }, []);

        const mapTheme = useMemo(() => {
            if (!mounted) return "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

            return (resolvedTheme || theme) === 'dark'
                ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
        }, [theme, resolvedTheme, mounted]);

        const points = useMemo(() => createPoints(services), [services]);

        // Create buffered bounds to prevent markers from disappearing at edges
        const bufferedBounds = useMemo((): BBox => {
            if (!bounds) return [-180, -85, 180, 85];

            const [west, south, east, north] = bounds;
            const bufferRatio = 0.5; // 15% buffer to ensure markers stay visible
            const lngBuffer = (east - west) * bufferRatio;
            const latBuffer = (north - south) * bufferRatio;

            return [
                west - lngBuffer,
                south - latBuffer,
                east + lngBuffer,
                north + latBuffer
            ];
        }, [bounds]);

        const { clusters, supercluster } = useSupercluster({
            points,
            bounds: bufferedBounds, // Use buffered bounds instead of raw bounds
            zoom,
            options: {
                map: mapFeature,
                reduce: reduceCluster,
                extent: 512,
                minZoom: 0,
                maxZoom: 24,
                radius: 75,
            },
        });

        // Throttled bounds update function
        const updateBounds = useCallback(() => {
            if (mapRef.current?.getMap()) {
                const newBounds = mapRef?.current?.getMap()?.getBounds()?.toArray().flat() as BBox;
                setBounds(newBounds);
            }
        }, []);

        const throttleTime = isMobile ? 30 : 100; // Much faster updates on mobile for smoother experience


        const throttledUpdateBounds = useRef(
            throttle(updateBounds, throttleTime)
        );

        // Update map style when theme changes
        useEffect(() => {
            if (mapRef.current?.getMap() && mounted) {
                try {
                    const map = mapRef.current.getMap();
                    const currentStyle = map.getStyle();

                    // Check if we need to update the style
                    const isDarkTheme = (resolvedTheme || theme) === 'dark';
                    const isCurrentlyDark = currentStyle?.name?.includes('dark-matter') ||
                        currentStyle?.sources?.['carto-dark'] !== undefined;

                    if (isDarkTheme !== isCurrentlyDark) {
                        map.setStyle(mapTheme);
                    }
                } catch (error) {
                    console.warn('Error updating map style:', error);
                    // Fallback: just set the style
                    mapRef.current.getMap().setStyle(mapTheme);
                }
            }
        }, [mapTheme, mounted, theme, resolvedTheme]);

        // Initial bounds setup and service changes
        useEffect(() => {
            updateBounds();
        }, [updateBounds, zoom, services]);

        // Close popup when zooming out too far
        useEffect(() => {
            if (zoom < 12) {
                setPopup(null);
            }
        }, [zoom, setPopup]);

        const expandCluster = useCallback(
            (clusterId: number, coords: Coordinates) => {
                if (!supercluster || !mapRef.current) return;

                const leaves: any[] = [];
                const pageSize = 50;
                let offset = 0;
                let fetched: any[];

                do {
                    fetched = supercluster.getLeaves(clusterId, pageSize, offset);
                    leaves.push(...fetched);
                    offset += pageSize;
                } while (fetched.length === pageSize);

                if (leaves.length === 0) return;

                const lngs = leaves.map(p => p.geometry.coordinates[0]);
                const lats = leaves.map(p => p.geometry.coordinates[1]);

                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);
                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);

                const bufferRatio = 0.02;
                const lngBuffer = (maxLng - minLng) * bufferRatio;
                const latBuffer = (maxLat - minLat) * bufferRatio;

                const bufferedBounds: BBox = [
                    minLng - lngBuffer,
                    minLat - latBuffer,
                    maxLng + lngBuffer,
                    maxLat + latBuffer,
                ];

                mapRef.current.fitBounds(
                    [
                        [bufferedBounds[0], bufferedBounds[1]],
                        [bufferedBounds[2], bufferedBounds[3]],
                    ],
                    {
                        padding: isMobile ? 80 : 90,
                        duration: 500,
                    },
                );
            },
            [supercluster, mapRef],
        );

        // const handleZoomIn = () => {
        //     if (mapRef.current?.getMap()) {
        //         mapRef.current.getMap().zoomIn({});
        //     }
        // };
        //
        // const handleZoomOut = () => {
        //     if (mapRef.current?.getMap()) {
        //         mapRef.current.getMap().zoomOut();
        //     }
        // };

        const handleFlyTo = useCallback((longitude: number, latitude: number) => {
            mapRef.current?.flyTo({
                center: [longitude, latitude],
                zoom: isMobile ? 17 : 16.5, // Slightly closer zoom on mobile
                speed: isMobile ? 3.5 : 4.5, // Slower, smoother animation on mobile
                curve: isMobile ? 1.2 : 0.8, // More curved path on mobile for smoother feeling
                easing: (t: number) => {
                    // Smoother easing function for mobile
                    return isMobile 
                        ? t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
                        : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                },
            });
        }, [mapRef, isMobile]);

        const clusterElements = useMemo(() => {
            return clusters.map(feature => {
                const [longitude, latitude] = feature.geometry.coordinates;
                const properties = feature.properties as any;

                if (properties.cluster) {
                    const { cluster_id, point_count, items } = properties;
                    const isActiveInCluster = items?.some(
                        (index: any) => index.id === selectedService?.id,
                    );

                    // Check if all items in the cluster are from the same category
                    let clusterCategory = null;
                    if (items && items.length > 0) {
                        const categories = items.map((item: any) => item.category);
                        const uniqueCategories = [...new Set(categories)];
                        
                        // If all items share the same category, use that category's icon
                        if (uniqueCategories.length === 1) {
                            clusterCategory = uniqueCategories[0] as string;
                        }
                        // Otherwise, clusterCategory remains null and will use default cluster icon
                    }

                    return (
                        <Cluster
                            key={`cluster-${cluster_id}`}
                            longitude={longitude}
                            latitude={latitude}
                            counter={point_count}
                            isSelected={isActiveInCluster}
                            category={clusterCategory}
                            onClick={() => {
                                expandCluster(cluster_id, { longitude, latitude });
                                setPopupCluster(null);
                            }}
                            onHover={() => {
                                if (popup) {
                                    // Optional: close popup on cluster hover
                                }
                            }}
                            onHoverOut={() => {}}
                            aria-label={`Cluster with ${point_count} items`}
                        />
                    );
                }

                const { id, item } = properties;
                return (
                    <Marker
                        key={`marker-${feature.id}-${item?.name}`}
                        longitude={longitude}
                        latitude={latitude}
                        category={item.category}
                        isSelected={selectedService?.id === item.id}
                        onClick={() => {
                            if (handleOpenPopup) {
                                handleOpenPopup({
                                    id: item.id,
                                    name: item.name,
                                    latitude,
                                    longitude,
                                    image: item.image,
                                    category: item.category,
                                    place: item.city,
                                });
                            }
                            handleClickedPlace(item.id);
                            handleFlyTo(longitude, latitude);
                        }}
                        aria-label={`Marker for ${item.name}`}
                    />
                );
            });
        }, [clusters, selectedService, expandCluster, popup, handleOpenPopup, handleClickedPlace, handleFlyTo]);

        const handleReset = () => {
            resetMap();
            setPopupCluster(null);
            scrollToTop();
        };

        // Resize observer effect
        useEffect(() => {
            const resizeMap = () => {
                if (mapRef.current) {
                    mapRef.current.resize();
                }
            };

            const resizeObserver = new ResizeObserver(() => {
                resizeMap();
            });

            if (containerRef.current) {
                resizeObserver.observe(containerRef.current);
            }

            window.addEventListener('resize', resizeMap);

            const bodyObserver = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' || mutation.type === 'attributes') {
                        setTimeout(resizeMap, 100);
                        break;
                    }
                }
            });

            const target = document.querySelector('body');
            if (target) {
                bodyObserver.observe(target, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'style'],
                });
            }

            setTimeout(resizeMap, 100);

            return () => {
                resizeObserver.disconnect();
                bodyObserver.disconnect();
                window.removeEventListener('resize', resizeMap);
            };
        }, [mapRef]);

        const handleZoomIn = useCallback(() => {
            const map = mapRef.current?.getMap?.();
            if (!map) return;

            const current = map.getZoom();
            const step = isMobile ? 0.6 : 0.4; // Bigger steps on mobile for better UX
            const next = Math.min(20, current + step);

            map.stop(); // cancel any ongoing animation
            map.zoomTo(next, { 
                duration: isMobile ? 300 : 200, // Slightly longer animation on mobile
                easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 // Smooth easing
            });
        }, [mapRef, isMobile]);

        const handleZoomOut = useCallback(() => {
            const map = mapRef.current?.getMap?.();
            if (!map) return;

            const current = map.getZoom();
            const step = isMobile ? 0.6 : 0.4; // Bigger steps on mobile for better UX
            const next = Math.max(1, current - step);

            map.stop(); // cancel any ongoing animation
            map.zoomTo(next, { 
                duration: isMobile ? 300 : 200, // Slightly longer animation on mobile
                easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 // Smooth easing
            });
        }, [mapRef, isMobile]);

        // Don't render until mounted to avoid hydration issues
        if (!mounted) {
            return (
                <div className="size-full rounded-xl md:rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
            );
        }

        return (
            <div
                ref={containerRef}
                className="size-full overflow-hidden rounded-xl md:rounded-md"
                aria-label="Overview Map"
            >
                <MapNoSsr
                    reuseMaps
                    initialViewState={initialViewState}
                    ref={mapRef}
                    style={{ width: '100%', height: '100%', overflow: 'visible'  }}
                    mapboxAccessToken="YOUR_MAPBOX_TOKEN_HERE"
                    mapStyle={mapTheme}
                    dragRotate={false}
                    touchZoomRotate={isMobile ? { 
                        around: 'center',
                        // enableRotation: false // Disable rotation on mobile for cleaner experience
                    } : { around: 'center' }}
                    touchPitch={false} // Disable pitch gestures for simpler mobile interaction
                    attributionControl={false}
                    doubleClickZoom={true} // Enable double-tap to zoom
                    scrollZoom={isMobile ? { 
                        around: 'center',
                        // smooth: true
                    } : true}
                    onZoomStart={() => {
                        setPopupFlag(false);
                        if (!isZoomingToMarker) {
                            setIsZoomingToMarker(true);
                        }
                    }}
                    onMove={throttledUpdateBounds.current} // Update bounds during pan/zoom
                    onMoveEnd={() => {
                        updateBounds(); // Final bounds update
                        setIsZoomingToMarker(false);
                    }}
                    onZoomEnd={(event) => {
                        setZoom(Math.round(event.viewState.zoom));
                        setPopupFlag(true);
                        updateBounds(); // Update bounds after zoom
                        if (!isZoomingToMarker) {
                            setIsZoomingToMarker(false);
                        }
                    }}
                    onLoad={(event) => {
                        const startBounds = event.target?.getBounds()?.toArray()?.flat();
                        if (startBounds) {
                            setBounds(startBounds as BBox);
                        }
                    }}
                    // Optimized mobile pan settings for smoother experience
                    dragPan={isMobile ? {
                        linearity: 0.2,      // More responsive feel
                        easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, // Smooth ease-in-out
                        maxSpeed: 1400,      // Faster response
                        deceleration: 2000   // Quicker deceleration for snappier feel
                    } : true}
                    keyboard={false}
                >
                    {clusterElements}
                    {popup && popupFlag && zoom >= 12 && (
                        <MarkerPopup
                            longitude={popup.longitude}
                            latitude={popup.latitude}
                            onClose={() => {
                                setPopup(null);
                            }}
                            image={popup.image}
                            name={popup.name}
                            place={popup.place}
                            category={popup.category}
                            isMobile={isMobile}
                            selectedService={selectedService}
                        />
                    )}

                    {services.length === 0 && (
                        <div className="absolute left-0 top-0 block h-fit w-full bg-red-600/75 md:hidden">
                            <span className="flex justify-center text-center text-white">
                                Nothing found
                            </span>
                        </div>
                    )}

                    {isZoomingToMarker && (
                        <div className="absolute left-0 top-0 block h-fit w-full bg-green-600/75 md:hidden">
                            <span className="flex justify-center text-center text-white">
                                Zooming
                            </span>
                        </div>
                    )}

                    <MapControls
                        handleZoomIn={handleZoomIn}
                        handleZoomOut={handleZoomOut}
                        handleReset={handleReset}
                        mapRef={mapRef}
                    />
                </MapNoSsr>
            </div>
        );
    },
);

OverviewMap.displayName = 'OverviewMap';
