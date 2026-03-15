'use client';

import React, { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PartialService, View } from '@/types';
import { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapList } from './map-list/map-list';
import { MobileBottomMarkerCard } from './mobile-bottom-marker-card/mobile-bottom-marker-card';
import { OverviewMap, PopupMarkerData } from './overview-map/overview-map';
import { useQueryState } from 'nuqs';
import { EmptyListState } from '@/app/[locale]/(main)/_components/empty-list-state';
import { useLocale } from 'next-intl';
import { calculateServicesBounds } from '@/lib/map-utils';
import { LngLatBoundsLike } from 'mapbox-gl';
import type { MapFilters } from '@/lib/map-slug-parser';

type Props = {
    services: PartialService[];
    initialFilters?: MapFilters;
};

type EmbeddingMeta = {
    executionTime?: number;
    contextualQuery?: string;
    relevanceThreshold?: number;
    count?: number;
    query?: string;
    category?: string;
} | null;

export function ServicesClientComponent({ services: initialServices, initialFilters }: Props) {
    const locale = useLocale();
    const [searchInput] = useQueryState('query', { defaultValue: '' });
    const [viewParam] = useQueryState('view', { defaultValue: 'map' });
    const [selectedSlug, setSelectedSlug] = useQueryState('slug', { defaultValue: '' });

    // Use filters from URL slugs (passed as props)
    const selectedCounty = initialFilters?.county || '';
    const selectedCategory = initialFilters?.category || '';
    const selectedCity = initialFilters?.city || '';
    const [popup, setPopup] = useState<PopupMarkerData | null>(null);
    const [selectedService, setSelectedService] = useState<PartialService | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [pendingScrollAfterViewChange, setPendingScrollAfterViewChange] = useState(false);
    const [embeddingResults, setEmbeddingResults] = useState<PartialService[]>([]);
    const [isLoadingEmbeddings, setIsLoadingEmbeddings] = useState(false);
    const [embeddingMeta, setEmbeddingMeta] = useState<EmbeddingMeta>(null);

    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSearchParamsRef = useRef<string>('');

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const currentView = isMobile ? viewParam : 'both';
    const [cardToExpand, setCardToExpand] = useState<string | null>(null);
    const mapRef = useRef<MapRef>(null);
    const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
    const mapListRef = useRef<{
        scrollToTop: () => void;
        scrollToIndex: (
            index: number,
            options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean },
        ) => void;
    }>(null);

    const previousSelectedCellName = useRef('');

    const frontendFilteredServices = useMemo(() => {
        const query = searchInput ? searchInput.toLowerCase().trim() : '';
        let filtered = initialServices;

        if (query) {
            filtered = filtered.filter(
                s =>
                    s.name.toLowerCase().includes(query) ||
                    s.description?.toLowerCase().includes(query) ||
                    s.city?.toLowerCase().includes(query) ||
                    s.category?.toLowerCase().includes(query) ||
                    s.tags?.some(tag => tag.toLowerCase().includes(query)),
            );
        }

        if (selectedCity) {
            filtered = filtered.filter(
                s => s.city?.toLowerCase() === selectedCity.toLowerCase(),
            );
        } else if (selectedCounty) {
            filtered = filtered.filter(
                s => s.voivodeship?.toLowerCase() === selectedCounty.toLowerCase(),
            );
        }

        if (selectedCategory) {
            filtered = filtered.filter(
                s => s.category?.toLowerCase() === selectedCategory.toLowerCase(),
            );
        }

        return filtered;
    }, [searchInput, selectedCounty, selectedCity, selectedCategory, initialServices]);

    const fetchEmbeddingResults = useCallback(
        async (query: string, category?: string, county?: string, excludeIds: string[] = []) => {
            try {
                const params = new URLSearchParams();
                params.set('query', query);
                if (category) params.set('category', category);
                if (county) params.set('county', county);
                params.set('locale', locale);
                params.set('semanticOnly', 'true');
                if (excludeIds.length > 0) {
                    params.set('excludeIds', excludeIds.join(','));
                }

                console.log(`🔍 Semantic search: "${query}" in category: ${category || 'any'}`);

                const response = await fetch(`/api/services?${params}`, {
                    signal: AbortSignal.timeout(8000),
                });

                if (!response.ok) {
                    throw new Error(`API responded with ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    console.log(`✅ Semantic search returned ${data.services.length} results`);
                    setEmbeddingResults(data.services);

                    // Enhanced metadata with all available information
                    setEmbeddingMeta({
                        executionTime: data.executionTime,
                        contextualQuery: data.contextualQuery,
                        relevanceThreshold: data.relevanceThreshold,
                        count: data.count,
                        query: data.query,
                        category: data.filters?.category,
                    });
                } else {
                    console.warn('❌ Semantic search failed:', data.message);
                    setEmbeddingResults([]);
                    setEmbeddingMeta(null);
                }
            } catch (error) {
                console.error('❌ Semantic search error:', error);
                setEmbeddingResults([]);
                setEmbeddingMeta(null);
            } finally {
                setIsLoadingEmbeddings(false);
            }
        },
        [locale],
    );

    useEffect(() => {
        const minResults = 3;
        const debounceMs = 800;
        const minQueryLength = 3;

        const hasQuery = searchInput && searchInput.trim().length >= minQueryLength;
        const currentSearchParams = `${searchInput}-${selectedCategory}-${selectedCounty}`;

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        setEmbeddingResults([]);
        setEmbeddingMeta(null);

        // Enhanced conditions for triggering embedding search
        const shouldTriggerEmbeddingSearch = () => {
            // Must have a query
            if (!hasQuery) return false;

            // Don't search if we already searched with same params
            if (currentSearchParams === lastSearchParamsRef.current) return false;

            // Trigger if we have too few results
            if (frontendFilteredServices.length < minResults) return true;

            // Also trigger if we have a category filter and query seems semantic
            // (contains multiple words or non-exact matches)
            if (selectedCategory && searchInput.trim().includes(' ')) {
                // Check if the query might be semantic (not just simple keyword matching)
                const queryWords = searchInput.toLowerCase().trim().split(/\s+/);
                const hasSemanticIndicators = queryWords.some(
                    word =>
                        word.length > 4 || // Longer words might be semantic
                        ['near', 'close', 'good', 'best', 'cheap', 'expensive', 'quality'].includes(
                            word,
                        ),
                );

                if (hasSemanticIndicators) return true;
            }

            return false;
        };

        if (shouldTriggerEmbeddingSearch()) {
            setIsLoadingEmbeddings(true);

            debounceTimeoutRef.current = setTimeout(() => {
                const excludeIds = frontendFilteredServices.map(s => s.serviceId);
                fetchEmbeddingResults(
                    searchInput.trim(),
                    selectedCategory || undefined,
                    selectedCounty || undefined,
                    excludeIds,
                );

                lastSearchParamsRef.current = currentSearchParams;
            }, debounceMs);
        } else {
            setIsLoadingEmbeddings(false);
            lastSearchParamsRef.current = currentSearchParams;
        }

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [
        searchInput,
        selectedCategory,
        selectedCounty,
        frontendFilteredServices.length,
        fetchEmbeddingResults,
    ]);

    const finalServices = useMemo(() => {
        // Don't merge - keep them separate
        return {
            frontendFiltered: frontendFilteredServices,
            embeddingResults: embeddingResults.filter(service => {
                if (selectedCity) {
                    if (service.city?.toLowerCase() !== selectedCity.toLowerCase()) {
                        return false;
                    }
                } else if (
                    selectedCounty &&
                    service.voivodeship?.toLowerCase() !== selectedCounty.toLowerCase()
                ) {
                    return false;
                }

                if (
                    selectedCategory &&
                    service.category?.toLowerCase() !== selectedCategory.toLowerCase()
                ) {
                    return false;
                }

                return true;
            })
        };
    }, [frontendFilteredServices, embeddingResults, selectedCounty, selectedCity, selectedCategory]);

    const filteredServices = useMemo(() => {
        return [...finalServices.frontendFiltered, ...finalServices.embeddingResults];
    }, [finalServices]);

    const handleHoverPlace = useCallback(
        (serviceId: string | null) => {
            if (popup) return;

            const found = filteredServices.find(s => s.id === serviceId);
            if (found) setSelectedService(found);
            else setSelectedService(null);
        },
        [filteredServices, popup],
    );

    const handlePopupStateChange = useCallback((popup: PopupMarkerData) => {
        setPopup(popup);
        if (!popup) {
            setSelectedService(null);
        }
    }, []);

    const handleClickedPlace = useCallback(
        (id: string) => {
            const service = filteredServices.find(s => s.id === id);
            if (!service) return;

            setCardToExpand(id);
            setSelectedService(service);

            // Set pending scroll for mobile regardless of current view
            // The scroll will happen when view becomes 'list' or 'both'
            if (isMobile) {
                setPendingScrollAfterViewChange(true);
            } else {
                // For desktop, scroll immediately if we're showing the list
                const cardIndex = filteredServices.findIndex(s => s.id === id);
                if (mapListRef.current && cardIndex !== -1) {
                    mapListRef.current.scrollToIndex(cardIndex, { smooth: true, align: 'center' });
                }
            }
        },
        [filteredServices, isMobile],
    );

    const handleOpenPopup = useCallback(
        ({ id, name, latitude, longitude, image, place, category }: PopupMarkerData) => {
            if (!mapRef.current) return;

            if (name === previousSelectedCellName.current && popup) {
                setPopup(null);
            } else {
                setPopup({
                    id,
                    name,
                    latitude,
                    longitude,
                    image,
                    place,
                    category,
                });
                previousSelectedCellName.current = name;

                const map = mapRef.current.getMap();
                map.stop();

                map.easeTo({
                    center: [longitude, latitude],
                    speed: 0.5,
                    padding: isMobile ? { top: 50, bottom: 200, left: 50, right: 50 } : undefined,
                });
            }
        },
        [mapRef, popup, isMobile, setPopup],
    );

    const handleFlyTo = useCallback((longitude: number, latitude: number) => {
        mapRef.current?.flyTo({
            center: [longitude, latitude],
            zoom: 16.5,
            speed: 4.5,
            curve: 0.8,
            easing: (t: number) => {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            },
        });
    }, []);

    const handleClosePopup = useCallback(() => {
        setSelectedService(null);
    }, []);

    const resetMap = useCallback(() => {
        setCardToExpand(null);
        handleClosePopup();
        setSelectedSlug(null);

        const ref = mapRef as RefObject<MapRef>;
        if (ref.current) {
            ref.current.fitBounds(
                [
                    [14.07, 49],
                    [24.15, 54.84],
                ],
                { duration: 1000, padding: 0 },
            );
        }
    }, [handleClosePopup, setSelectedSlug]);

    const scrollToTop = useCallback(() => {
        if (mapListRef.current) {
            mapListRef.current.scrollToIndex(0, { smooth: true });
        }
    }, []);

    useEffect(() => {
        const resizeMapOnDOMChanges = () => {
            if (mapRef.current) {
                setTimeout(() => {
                    mapRef.current?.resize();
                }, 100);
            }
        };

        const observer = new MutationObserver(mutations => {
            let shouldResize = false;

            for (const mutation of mutations) {
                if (
                    mutation.type === 'childList' ||
                    (mutation.type === 'attributes' &&
                        (mutation.attributeName === 'class' || mutation.attributeName === 'style'))
                ) {
                    shouldResize = true;
                    break;
                }
            }

            if (shouldResize) {
                resizeMapOnDOMChanges();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style'],
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (mapRef.current) {
                mapRef.current.resize();
            }
        };

        window.addEventListener('resize', handleResize);
        window.visualViewport?.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        if (selectedSlug) {
            const service = filteredServices.find(s => s.slug === selectedSlug);
            if (service) {
                setCardToExpand(service.id);
                setSelectedService(service);
                setPendingScrollAfterViewChange(true);
            } else {
                setSelectedSlug(null);
            }
        }
    }, [selectedSlug, filteredServices, setSelectedSlug]);

    useEffect(() => {
        if (cardToExpand === null) {
            setSelectedSlug(null);
        } else {
            const service = filteredServices.find(s => s.id === cardToExpand);
            if (service?.slug) {
                setSelectedSlug(service.slug);
            }
        }
    }, [cardToExpand, filteredServices, setSelectedSlug]);

    useEffect(() => {
        if ((!selectedCounty && !selectedCity) || !mapRef.current) return;

        // Filter services for the selected city or county
        let locationServices;
        if (selectedCity) {
            locationServices = filteredServices.filter(
                service => service.city?.toLowerCase() === selectedCity.toLowerCase(),
            );
        } else {
            locationServices = filteredServices.filter(
                service => service.voivodeship?.toLowerCase() === selectedCounty.toLowerCase(),
            );
        }

        const servicesBounds = calculateServicesBounds(locationServices) as LngLatBoundsLike;

        if (servicesBounds && locationServices.length > 0) {
            console.log(`Zooming to ${locationServices.length} services in ${selectedCity || selectedCounty}`);
            mapRef.current.fitBounds(servicesBounds, {
                duration: 1000,
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
            });
        } else {
            console.log(`No services found in ${selectedCity || selectedCounty} - showing whole Poland`);
            // Show whole Poland when no services in selected location
            mapRef.current.fitBounds(
                [
                    [14.07, 49], // Southwest of Poland
                    [24.15, 54.84], // Northeast of Poland
                ],
                {
                    duration: 1000,
                    padding: { top: 50, bottom: 50, left: 50, right: 50 },
                },
            );
        }

        // Close any open popups when changing location
        setPopup(null);
        setSelectedService(null);
        setCardToExpand(null);
    }, [filteredServices, selectedCounty, selectedCity]);

    useEffect(() => {
        if (
            pendingScrollAfterViewChange &&
            cardToExpand !== null &&
            (viewParam === 'list' || viewParam === 'both')
        ) {
            const index = filteredServices.findIndex(s => s.id === cardToExpand);

            if (index !== -1 && mapListRef.current) {
                // Add a small delay to ensure the list view is fully rendered
                const scrollDelay = isMobile ? 100 : 50;

                const scrollToCard = () => {
                    if (mapListRef.current) {
                        mapListRef.current.scrollToIndex(index, {
                            smooth: true,
                            align: 'start',
                        });
                    }
                    setPendingScrollAfterViewChange(false);
                };

                const cardElement = cardRefs.current[index];

                if (cardElement) {
                    const resizeObserver = new ResizeObserver(entries => {
                        for (const entry of entries) {
                            if (entry.contentBoxSize[0].blockSize > 0) {
                                setTimeout(scrollToCard, scrollDelay);
                                resizeObserver.disconnect();
                                break;
                            }
                        }
                    });

                    resizeObserver.observe(cardElement);

                    // Fallback timeout - increased for mobile
                    const fallbackTimeout = setTimeout(() => {
                        scrollToCard();
                        resizeObserver.disconnect();
                    }, isMobile ? 1000 : 700);

                    return () => {
                        resizeObserver.disconnect();
                        clearTimeout(fallbackTimeout);
                    };
                } else {
                    // If no card element, try scrolling after a delay
                    setTimeout(scrollToCard, scrollDelay);
                }
            } else {
                setPendingScrollAfterViewChange(false);
            }
        } else if (pendingScrollAfterViewChange && cardToExpand === null) {
            setPendingScrollAfterViewChange(false);
        }
    }, [pendingScrollAfterViewChange, cardToExpand, viewParam, filteredServices, isMobile]);

    useEffect(() => {
        if (popup) {
            // Check if the service that has the popup is still in the filtered results
            const isServiceStillVisible = filteredServices.some(service => service.id === popup.id);

            if (!isServiceStillVisible) {
                setPopup(null);
                setSelectedService(null);
                // Also reset card expansion if needed
                if (cardToExpand === popup.id) {
                    setCardToExpand(null);
                }
            }
        }
    }, [filteredServices, popup, setPopup, cardToExpand, setCardToExpand]);


    return (
        <div className={`flex size-full ${currentView === 'map' ? 'map-view' : ''}`}>
            {process.env.NODE_ENV === 'development' &&
                (searchInput || embeddingResults.length > 0) && (
                    <div className="absolute right-0 top-0 z-50 bg-black p-2 text-xs text-white">
                        <div>Frontend: {frontendFilteredServices.length}</div>
                        {embeddingResults.length > 0 && (
                            <div>Embedding: {embeddingResults.length}</div>
                        )}
                        <div>Total: {filteredServices.length}</div>
                        {isLoadingEmbeddings && <div>🔄 Loading...</div>}
                        {embeddingMeta?.executionTime && <div>{embeddingMeta.executionTime}ms</div>}
                        {embeddingMeta?.contextualQuery && (
                            <div title={embeddingMeta.contextualQuery}>
                                Query: {embeddingMeta.contextualQuery.slice(0, 30)}...
                            </div>
                        )}
                        {embeddingMeta?.relevanceThreshold && (
                            <div>Threshold: {embeddingMeta.relevanceThreshold}</div>
                        )}
                    </div>
                )}

            <div
                className={`${currentView === 'list' || currentView === 'both' ? 'block' : 'hidden'} 
         ${currentView === 'both' ? 'md:w-7/12' : 'w-full'}
         ${isMobile && currentView === 'list' ? 'mobile-content-offset' : ''}`}
                style={{
                    height: isMobile && currentView === 'list' ? 'height: calc(100vh - 200px)' : '100%',
                }}
            >
                <div
                    className="safari-only-pt-16 h-full overflow-y-auto"
                    style={{
                        height: isMobile && currentView === 'list' ? '100%' : undefined,
                    }}
                >
                    {finalServices.frontendFiltered.length > 0 || finalServices.embeddingResults.length > 0 || isLoadingEmbeddings ? (
                        <>
                            <MapList
                                ref={mapListRef}
                                handleHoverPlace={handleHoverPlace}
                                resetMap={resetMap}
                                handleFlyTo={handleFlyTo}
                                frontendFilteredServices={finalServices.frontendFiltered}
                                embeddingResults={finalServices.embeddingResults}
                                isLoadingEmbeddings={isLoadingEmbeddings}
                                embeddingMeta={embeddingMeta}
                                cardRefs={cardRefs}
                                cardToExpand={cardToExpand}
                                setCardToExpand={setCardToExpand}
                                scrollToTop={scrollToTop}
                                setPopup={setPopup}
                            />

                            {/*{isLoadingEmbeddings && (*/}
                            {/*    <div className="flex flex-col gap-y-2 p-2 md:gap-y-4">*/}
                            {/*        {Array(3)*/}
                            {/*            .fill(0)*/}
                            {/*            .map((_, i) => (*/}
                            {/*                <ServiceCardSkeleton key={`skeleton-${i}`} />*/}
                            {/*            ))}*/}
                            {/*    </div>*/}
                            {/*)}*/}
                        </>
                    ) : (
                        <EmptyListState />
                    )}
                </div>
            </div>

            <div
                className={`${currentView === 'map' || currentView === 'both' ? 'block' : 'hidden'} 
                     h-full ${currentView === 'both' ? 'md:w-5/12' : 'w-full'} relative`}
            >
                <div className="absolute inset-0">
                    <OverviewMap
                        ref={mapRef}
                        selectedService={selectedService}
                        services={filteredServices}
                        handleClickedPlace={handleClickedPlace}
                        resetMap={resetMap}
                        scrollToTop={scrollToTop}
                        popup={popup}
                        setPopup={setPopup}
                        handleOpenPopup={handleOpenPopup}
                    />
                </div>
            </div>

            <MobileBottomMarkerCard
                selectedService={selectedService}
                handleClose={handleClosePopup}
                currentView={viewParam as View}
            />
        </div>
    );
}
