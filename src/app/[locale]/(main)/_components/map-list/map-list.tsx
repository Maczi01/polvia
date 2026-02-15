import { PartialService, ScrollableListHandle } from '@/types';
import {
    forwardRef, JSX,
    RefObject,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import { ServiceCard } from '../service-card/service-card';
import { VList, VListHandle } from 'virtua';
import { useScrollableListHandle } from '@/hooks/use-scrollable-list-handle';
import { ArrowUp, Sparkles, Search } from 'lucide-react';
import { PopupMarkerData } from '@/app/[locale]/(main)/_components/overview-map/overview-map';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/app/[locale]/(main)/_components/map-list/empty-state';
import { LoadingSkeleton } from '@/app/[locale]/(main)/_components/map-list/loading-skeleton';

type EmbeddingMeta = {
    executionTime?: number;
    contextualQuery?: string;
    relevanceThreshold?: number;
    count?: number;
    query?: string;
    category?: string;
} | null;

type MapListProps = {
    frontendFilteredServices: PartialService[];
    embeddingResults: PartialService[];
    isLoadingEmbeddings: boolean;
    embeddingMeta: EmbeddingMeta;
    handleFlyTo: (latitude: number, longitude: number) => void;
    resetMap: () => void;
    handleHoverPlace: (id: string | null) => void;
    cardRefs: RefObject<(HTMLDivElement | null)[]>;
    setCardToExpand: (id: string | null) => void;
    cardToExpand: string | null;
    scrollToTop: () => void;
    setPopup: (popup: PopupMarkerData | null) => void;
};

// Section Header Component - matches ServiceCard height
const SectionHeader = ({
                           icon: Icon,
                           title,
                           // count,
                           subtitle
                       }: {
    icon: React.ElementType;
    title: string;
    // count: number;
    subtitle?: string;
}) => (
    <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-2 md:mb-4 shadow-sm md:h-[124px]">
        <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        <div className="flex-1">
            <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                {/*<span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300">*/}
                {/*    {count}*/}
                {/*</span>*/}
            </div>
            {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
        </div>
    </div>
);

// Empty State Component


// Loading Skeleton Component - first skeleton is header, rest are cards

export const MapList = forwardRef<ScrollableListHandle, MapListProps>(
    (
        {
            frontendFilteredServices,
            embeddingResults,
            isLoadingEmbeddings,
            embeddingMeta,
            handleFlyTo,
            resetMap,
            handleHoverPlace,
            cardRefs,
            setCardToExpand,
            cardToExpand,
            setPopup,
        }: MapListProps,
        ref,
    ) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const virtuaListRef = useRef<VListHandle>(null);
        const [showScrollButton, setShowScrollButton] = useState(false);
        const isMobile = useMediaQuery('(max-width: 768px)');
        const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
        const t = useTranslations('MapList')

        const prevExpandedIndex = useRef<number | null>(null);
        const CARD_COLLAPSE_MS = 300;

        // Combine services for internal logic (refs, scrolling, etc.)
        const allServices = [...frontendFilteredServices, ...embeddingResults];

        useScrollableListHandle(ref, containerRef, virtuaListRef, allServices);

        // Improved scroll behavior for mobile
        const scrollToIndex = useCallback(
            (index: number, options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }) => {
                if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                }

                const target = cardRefs.current?.[index];
                if (isMobile && target) {
                    scrollTimeoutRef.current = setTimeout(() => {
                        target.scrollIntoView({
                            behavior: options?.smooth === false ? 'auto' : 'smooth',
                            block: options?.align || 'start',
                            inline: 'nearest'
                        });
                    }, 50);
                } else if (virtuaListRef.current) {
                    virtuaListRef.current.scrollToIndex(index, {
                        align: options?.align || 'start',
                        smooth: options?.smooth || false,
                    });
                }
            },
            [cardRefs, isMobile],
        );

        useEffect(() => {
            const handleScroll = () => {
                if (!containerRef.current) return;
                setShowScrollButton(containerRef.current.scrollTop > 300);
            };
            const container = containerRef.current;
            container?.addEventListener('scroll', handleScroll);
            handleScroll();
            return () => {
                container?.removeEventListener('scroll', handleScroll);
                if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                }
            };
        }, []);

        useImperativeHandle(
            ref,
            () => ({
                scrollToIndex,
                scrollToTop: () => {
                    if (isMobile && containerRef.current) {
                        containerRef.current.scrollTo({
                            top: 0,
                            behavior: 'smooth',
                        });
                    } else if (virtuaListRef.current) {
                        virtuaListRef.current.scrollToIndex(0, {
                            align: 'start',
                            smooth: false,
                        });
                    }
                },
            }),
            [scrollToIndex, isMobile],
        );

        useEffect(() => {
            if (cardToExpand === null) {
                prevExpandedIndex.current = null;
                return;
            }

            const idx = allServices.findIndex((s) => s.id === cardToExpand);
            if (idx === -1) {
                prevExpandedIndex.current = null;
                return;
            }

            prevExpandedIndex.current = idx;

            if (isMobile) {
                const scrollTimeout = setTimeout(() => {
                    const target = cardRefs.current?.[idx];
                    if (target) {
                        const rect = target.getBoundingClientRect();
                        if (rect.top > 100) {
                            target.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                                inline: 'nearest'
                            });
                        }
                    }
                }, 100);

                return () => clearTimeout(scrollTimeout);
            } else {
                requestAnimationFrame(() => scrollToIndex(idx));

                const settleDelay = CARD_COLLAPSE_MS + 50;
                const timeout = setTimeout(() => {
                    scrollToIndex(idx);
                }, settleDelay);

                return () => clearTimeout(timeout);
            }
        }, [cardToExpand, allServices, scrollToIndex, isMobile, cardRefs]);

        // Create service cards with proper indexing
        const renderServiceCards = () => {
            const cards: JSX.Element[] = [];
            let cardIndex = 0;

            // Main results section - no header for regular results
            frontendFilteredServices.forEach((service, index) => {
                cards.push(
                    <div key={`main-${service.id}`} className="mb-2 md:mb-4">
                        <ServiceCard
                            ref={element => {
                                if (cardRefs.current) {
                                    cardRefs.current[cardIndex] = element;
                                }
                            }}
                            handleFlyTo={handleFlyTo}
                            index={cardIndex}
                            resetMap={resetMap}
                            setCardToExpand={setCardToExpand}
                            cardToExpand={cardToExpand}
                            handleHoverPlace={handleHoverPlace}
                            setPopup={setPopup}
                            {...service}
                        />
                    </div>
                );
                cardIndex++;
            });

            // No main results - use single EmptyState component for all scenarios
            if (frontendFilteredServices.length === 0) {
                cards.push(
                    <div key="no-main-results">
                        <EmptyState
                            message={t("no_exact_matches")}
                            icon={Search}
                            isLoadingRecommendations={isLoadingEmbeddings}
                            hasRecommendations={embeddingResults.length > 0}
                        />
                    </div>
                );
            }

            // Embedding results section
            if (embeddingResults.length > 0) {
                const subtitle = embeddingMeta?.contextualQuery
                    ? `${t("based_on")} "${embeddingMeta.contextualQuery.slice(0, 50)}${embeddingMeta.contextualQuery.length > 50 ? '...' : ''}"`
                    : `${t("semantic_search_results")}`;

                cards.push(
                    <SectionHeader
                        key="embedding-header"
                        icon={Sparkles}
                        title= {t("also_recommended")}
                        // count={embeddingResults.length}
                        subtitle={subtitle}
                    />
                );

                embeddingResults.forEach((service) => {
                    cards.push(
                        <div key={`embedding-${service.id}`} className="mb-2 md:mb-4">
                            <ServiceCard
                                ref={element => {
                                    if (cardRefs.current) {
                                        cardRefs.current[cardIndex] = element;
                                    }
                                }}
                                handleFlyTo={handleFlyTo}
                                index={cardIndex}
                                resetMap={resetMap}
                                setCardToExpand={setCardToExpand}
                                cardToExpand={cardToExpand}
                                handleHoverPlace={handleHoverPlace}
                                setPopup={setPopup}
                                {...service}
                            />
                        </div>
                    );
                    cardIndex++;
                });
            }

            // Loading state for embedding results (only show if we have main results)
            if (isLoadingEmbeddings && frontendFilteredServices.length > 0) {
                cards.push(
                    <div key="loading-embeddings" className="mt-6">
                        <SectionHeader
                            icon={Sparkles}
                            title={t("finding_more_results")}
                            // count={0}
                            subtitle={t("searching_recommendations")}
                        />
                        <LoadingSkeleton />
                    </div>
                );
            }

            return cards;
        };

        const handleScrollToTop = () => {
            if (isMobile && containerRef.current) {
                containerRef.current.scrollTo({
                    top: 0,
                    behavior: 'smooth',
                });
            } else if (virtuaListRef.current) {
                virtuaListRef.current.scrollToIndex(0, {
                    align: 'start',
                    smooth: false,
                });
            }
        };

        // Show empty state when no results at all
        if (frontendFilteredServices.length === 0 && embeddingResults.length === 0 && !isLoadingEmbeddings) {
            return (
                <div className="h-full flex items-center justify-center bg-[#F6F6F7] dark:bg-gray-900">
                    <EmptyState
                        message="No services found. Try adjusting your search criteria."
                        icon={Search}
                    />
                </div>
            );
        }

        return (
            <div
                ref={containerRef}
                className="scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800
                hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-500
                    flex flex-col bg-[#F6F6F7] dark:bg-gray-900
                    px-2 md:pl-0 md:pr-2 relative scroll-padding"
                style={{
                    height: '100%',
                    overflowY: 'auto',
                    paddingTop: isMobile ? '8px' : '0px',
                    WebkitOverflowScrolling: 'touch',
                    transform: 'translate3d(0,0,0)',
                }}
            >
                {isMobile ? (
                    <div className="size-full pb-8" style={{ minHeight: 'fit-content' }}>
                        {renderServiceCards()}
                    </div>
                ) : (
                    <VList
                        key={allServices.length}
                        ref={virtuaListRef}
                        className="size-full"
                        overscan={40}
                        shift={false}
                    >
                        {renderServiceCards()}
                    </VList>
                )}
            </div>
        );
    },
);

MapList.displayName = 'MapList';
