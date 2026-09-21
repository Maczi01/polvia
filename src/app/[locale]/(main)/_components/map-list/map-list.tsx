import { PartialService, ScrollableListHandle } from '@/types';
import {
    buildListRows,
    findCardIndex,
    findCollapsedGroupKey,
    findRowIndex,
    onlineHeaderRowIndex,
} from '@/lib/map-list-rows';
import { ServiceGroupCard } from '@/app/[locale]/(main)/_components/service-group-card/service-group-card';
import {
    forwardRef, JSX,
    RefObject,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { ServiceCard } from '../service-card/service-card';
import { VList, VListHandle } from 'virtua';
import { ArrowDown, ArrowUp, Globe, Sparkles, Search } from 'lucide-react';
import { PopupMarkerData } from '@/app/[locale]/(main)/_components/overview-map/overview-map';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/app/[locale]/(main)/_components/map-list/empty-state';
import { LoadingSkeleton } from '@/app/[locale]/(main)/_components/map-list/loading-skeleton';
import { Button } from '@/components/ui/button/button';

/** Ile pikseli trzeba przewinac liste, zanim pojawi sie strzalka powrotu na gore. */
const SCROLL_TO_TOP_THRESHOLD_PX = 300;

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
    /** Uslugi dostepne zdalnie, po odjeciu tego, co widac w pozostalych sekcjach (R6). */
    onlineResults: PartialService[];
    embeddingResults: PartialService[];
    isLoadingEmbeddings: boolean;
    embeddingMeta: EmbeddingMeta;
    handleFlyTo: (latitude: number, longitude: number) => void;
    resetMap: () => void;
    handleHoverPlace: (id: string | null) => void;
    /** Dopasowanie widoku mapy do punktow rozwijanej firmy. */
    onGroupExpand?: (services: PartialService[]) => void;
    /** Podswietlenie kompletu pinow firmy przy najechaniu na zwinieta karte. */
    handleHoverGroup?: (serviceIds: string[] | null) => void;
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
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:mb-4 md:h-[124px]">
        <Icon className="size-5 text-gray-600 dark:text-gray-400" />
        <div className="flex-1">
            <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                {/*<span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300">*/}
                {/*    {count}*/}
                {/*</span>*/}
            </div>
            {subtitle && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
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
            onlineResults,
            embeddingResults,
            isLoadingEmbeddings,
            embeddingMeta,
            handleFlyTo,
            resetMap,
            handleHoverPlace,
            onGroupExpand,
            handleHoverGroup,
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
        const onlineSectionRef = useRef<HTMLDivElement>(null);
        const CARD_COLLAPSE_MS = 300;

        // Combine services for internal logic (refs, scrolling, etc.)
        // KOLEJNOSC MUSI ODPOWIADAC kolejnosci renderowania sekcji w renderServiceCards(),
        // bo `cardIndex` i `cardRefs` sa wspolne dla wszystkich sekcji. Rozjechanie
        // tego psuje scrollowanie i rozwijanie kart.
        const allServices = useMemo(
            () => [...frontendFilteredServices, ...onlineResults, ...embeddingResults],
            [frontendFilteredServices, onlineResults, embeddingResults],
        );

        /**
         * Jedyne zrodlo ukladu listy. Renderer iteruje po tym, a nie buduje
         * wlasnej kolejnosci — dzieki temu numeracja kart i numeracja dzieci
         * `VList` nie moga sie juz rozjechac.
         */
        /**
         * Grupy rozwiniete przez uzytkownika. Domyslnie wszystkie zwiniete.
         *
         * SWIADOMIE bez akordeonu: zwiniecie grupy stojacej NAD viewportem usuwa
         * wiersze powyzej i tresc podskakuje uzytkownikowi pod palcami. Rozwijanie
         * jest bezpieczne, bo wstawia wiersze pod klikniętym naglowkiem, ktory z
         * definicji jest widoczny.
         */
        const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
            () => new Set<string>(),
        );

        const toggleGroup = useCallback(
            (key: string, services: PartialService[]) => {
                // Decyzja PRZED `setExpandedGroups`, nie w jego funkcji aktualizujacej.
                // React wykonuje updater w trakcie renderu, wiec `onGroupExpand`
                // wywolany w srodku ustawialby stan mapy podczas renderowania listy
                // ("Cannot update a component while rendering a different component").
                const willExpand = !expandedGroups.has(key);

                setExpandedGroups(previous => {
                    const next = new Set(previous);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                });

                // Dopasowanie widoku tylko przy ROZWIJANIU. Przy zwijaniu
                // przestawianie mapy byloby ruchem, o ktory nikt nie prosil.
                if (willExpand) onGroupExpand?.(services);
            },
            [expandedGroups, onGroupExpand],
        );

        /**
         * Zwinieta grupa odpowiada N pinom, wiec nie ma jednego, nad ktorym mialby
         * stanac popup. Zamiast popupu podswietlamy komplet punktow firmy, a sam
         * popup czyscimy — inaczej zostalby wiszacy nad przypadkowym pinem.
         */
        const handleGroupHover = useCallback(
            (serviceIds: string[] | null) => {
                handleHoverPlace(null);
                handleHoverGroup?.(serviceIds);
            },
            [handleHoverPlace, handleHoverGroup],
        );

        const rows = useMemo(
            () =>
                buildListRows({
                    main: frontendFilteredServices,
                    online: onlineResults,
                    embedding: embeddingResults,
                    isLoadingEmbeddings,
                    expandedGroups,
                }),
            [frontendFilteredServices, onlineResults, embeddingResults, isLoadingEmbeddings, expandedGroups],
        );

        // Improved scroll behavior for mobile
        /**
         * Skok do WIERSZA listy. Przyjmuje OBA numery, bo kazda sciezka potrzebuje
         * innego: mobile siega do `cardRefs` (numeracja samych kart), a desktop
         * oddaje numer do `virtua` (numeracja wszystkich dzieci `VList`, razem
         * z naglowkami sekcji). Wczesniej obie dostawaly ten sam numer, wiec na
         * desktopie karty sekcji online i embedding byly chybiane o liczbe
         * naglowkow stojacych wyzej.
         */
        const scrollToRow = useCallback(
            (
                rowIndex: number,
                cardIndex: number,
                options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean },
            ) => {
                if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                }

                const target = cardIndex >= 0 ? cardRefs.current?.[cardIndex] : null;
                if (isMobile && target) {
                    scrollTimeoutRef.current = setTimeout(() => {
                        target.scrollIntoView({
                            behavior: options?.smooth === false ? 'auto' : 'smooth',
                            block: options?.align || 'start',
                            inline: 'nearest'
                        });
                    }, 50);
                } else if (virtuaListRef.current && rowIndex >= 0) {
                    virtuaListRef.current.scrollToIndex(rowIndex, {
                        align: options?.align || 'start',
                        smooth: options?.smooth || false,
                    });
                }
            },
            [cardRefs, isMobile],
        );

        /** Skok do karty konkretnej uslugi — oba numery wylicza model wierszy. */
        const scrollToService = useCallback(
            (serviceId: string, options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }) => {
                scrollToRow(findRowIndex(rows, serviceId), findCardIndex(rows, serviceId), options);
            },
            [rows, scrollToRow],
        );

        /**
         * Skok do sekcji uslug online. Dwa etapy, bo zaden pojedynczy nie wystarcza:
         *
         * 1. `scrollToIndex` po indeksie — jedyny sposob dotarcia do elementu, ktory
         *    przy wirtualizacji NIE JEST jeszcze zamontowany. `smooth: false`
         *    swiadomie: `virtua` szacuje pozycje z niezmierzonych elementow, wiec
         *    plynne przewijanie na dystansie kilkudziesieciu kart nie dojezdza do celu
         *    (ten sam wniosek jest juz w `scrollToTop`).
         * 2. `scrollIntoView` na prawdziwym elemencie, gdy juz sie zamontowal — koryguje
         *    blad oszacowania i dziala takze wtedy, gdy przewija sie zewnetrzny kontener
         *    (`overflowY: auto`), a nie ten, ktory `virtua` uwaza za swoj.
         *
         * Indeks: naglowek sekcji online stoi w liscie dzieci VList dokladnie za
         * wszystkimi kartami lokalnymi. Banner renderuje sie tylko gdy oba kubelki sa
         * niepuste, wiec EmptyState nie przesuwa tu numeracji.
         */
        const scrollToOnlineSection = useCallback(() => {
            // Indeks naglowka bierze sie z modelu wierszy, a nie z dlugosci tablicy.
            // Arytmetyka na `frontendFilteredServices.length` trafiala tu przypadkiem
            // i przestawala dzialac przy kazdej zmianie ukladu sekcji.
            scrollToRow(onlineHeaderRowIndex(rows), -1, { align: 'start', smooth: false });

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    onlineSectionRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    });
                });
            });
        }, [scrollToRow, rows]);

        useEffect(() => {
            const handleScroll = () => {
                if (!containerRef.current) return;
                setShowScrollButton(containerRef.current.scrollTop > SCROLL_TO_TOP_THRESHOLD_PX);
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

        /**
         * Powrot na gore listy. Na mobile przewija sie `containerRef`, na desktopie
         * wlasny scroller `VList`.
         *
         * `smooth` dziala tu w OBU sciezkach, inaczej niz przy `scrollToOnlineSection`.
         * Tamten skok idzie w DOL, do kart jeszcze niezmierzonych, wiec `virtua` celuje
         * w oszacowanie i nie dojezdza. Tutaj celem jest offset `0`, a karty powyzej sa
         * juz zmierzone — bledne oszacowanie nie ma czego zepsuc.
         */
        const handleScrollToTop = useCallback(() => {
            if (isMobile && containerRef.current) {
                containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                virtuaListRef.current?.scrollToIndex(0, { align: 'start', smooth: true });
            }
        }, [isMobile]);

        /**
         * Zmiana liczby wynikow przestawia liste na gore: `VList` dostaje nowy `key`
         * i montuje sie od zera, a kontener mobilny zostaje przyciety do nowej
         * wysokosci. Zadne z tych przewiniec nie emituje zdarzenia `scroll`, wiec
         * widocznosc strzalki trzeba przeliczyc recznie — inaczej zostaje wisiec
         * nad lista, ktora jest juz na samej gorze.
         */
        useEffect(() => {
            const offset = isMobile ? (containerRef.current?.scrollTop ?? 0) : 0;
            setShowScrollButton(offset > SCROLL_TO_TOP_THRESHOLD_PX);
        }, [allServices.length, isMobile]);

        useImperativeHandle(
            ref,
            () => ({
                scrollToService,
                scrollToTop: handleScrollToTop,
            }),
            [scrollToService, handleScrollToTop],
        );

        useEffect(() => {
            if (cardToExpand === null) {
                prevExpandedIndex.current = null;
                return;
            }

            /**
             * Lokalizacja moze byc schowana w zwinietej grupie — tak wchodzi kazdy
             * link `?place=<slug>` do oddzialu firmy wielooddzialowej oraz klik w
             * pin na mapie. Najpierw rozwijamy grupe; zmiana `rows` odpala ten
             * efekt ponownie i wtedy jest juz do czego przewijac.
             */
            const collapsedGroupKey = findCollapsedGroupKey(rows, cardToExpand);
            if (collapsedGroupKey) {
                setExpandedGroups(previous => new Set(previous).add(collapsedGroupKey));
                return;
            }

            const cardIdx = findCardIndex(rows, cardToExpand);
            if (cardIdx === -1) {
                prevExpandedIndex.current = null;
                return;
            }

            const rowIdx = findRowIndex(rows, cardToExpand);
            prevExpandedIndex.current = cardIdx;

            if (isMobile) {
                const scrollTimeout = setTimeout(() => {
                    const target = cardRefs.current?.[cardIdx];
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
                requestAnimationFrame(() => scrollToRow(rowIdx, cardIdx));

                // Drugi strzal po ustaniu animacji rozwijania. `virtua` szacuje
                // pozycje z niezmierzonych elementow, wiec pierwszy celuje w stara
                // wysokosc karty; ten koryguje po zmierzeniu nowej.
                const settleDelay = CARD_COLLAPSE_MS + 50;
                const timeout = setTimeout(() => {
                    scrollToRow(rowIdx, cardIdx);
                }, settleDelay);

                return () => clearTimeout(timeout);
            }
        }, [cardToExpand, rows, scrollToRow, isMobile, cardRefs]);

        /**
         * Renderer iteruje po `rows` i NIE liczy wlasnych indeksow. Wczesniej
         * numeracja powstawala tutaj (`cardIndex++`) rownolegle do `allServices`,
         * a ich zgodnosci pilnowal wylacznie komentarz.
         */
        const renderServiceCards = () => {
            const embeddingSubtitle = embeddingMeta?.contextualQuery
                ? `${t('based_on')} "${embeddingMeta.contextualQuery.slice(0, 50)}${embeddingMeta.contextualQuery.length > 50 ? '...' : ''}"`
                : t('semantic_search_results');

            return rows.map(row => {
                switch (row.kind) {
                    case 'card': {
                        const service = row.service!;
                        const cardIndex = row.cardIndex!;

                        return (
                            <div key={row.key} className="mb-2 md:mb-4">
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
                    }

                    case 'group': {
                        const group = row.group!;

                        return (
                            <ServiceGroupCard
                                key={row.key}
                                name={group.name}
                                services={group.services}
                                cities={group.cities}
                                isExpanded={row.isExpanded ?? false}
                                onToggle={() => toggleGroup(row.key, group.services)}
                                onHover={handleGroupHover}
                            />
                        );
                    }

                    case 'empty':
                        return (
                            <div key={row.key}>
                                <EmptyState
                                    message={t('no_exact_matches')}
                                    icon={Search}
                                    isLoadingRecommendations={isLoadingEmbeddings}
                                    hasRecommendations={
                                        onlineResults.length > 0 || embeddingResults.length > 0
                                    }
                                />
                            </div>
                        );

                    // Sekcja online jest widoczna niezaleznie od filtra geograficznego
                    // (R4) — wpisy bez pinu na mapie zyja wylacznie tutaj.
                    case 'onlineHeader':
                        return (
                            <div key={row.key} ref={onlineSectionRef}>
                                <SectionHeader
                                    icon={Globe}
                                    title={t('available_online', { count: onlineResults.length })}
                                    subtitle={t('available_online_subtitle')}
                                />
                            </div>
                        );

                    case 'embeddingHeader':
                        return (
                            <SectionHeader
                                key={row.key}
                                icon={Sparkles}
                                title={t('also_recommended')}
                                subtitle={embeddingSubtitle}
                            />
                        );

                    case 'loading':
                        return (
                            <div key={row.key} className="mt-6">
                                <SectionHeader
                                    icon={Sparkles}
                                    title={t('finding_more_results')}
                                    subtitle={t('searching_recommendations')}
                                />
                                <LoadingSkeleton />
                            </div>
                        );
                }
            });
        };

        // Show empty state when no results at all
        if (frontendFilteredServices.length === 0 && onlineResults.length === 0 && embeddingResults.length === 0 && !isLoadingEmbeddings) {
            return (
                <div className="flex h-full items-center justify-center bg-[#F6F6F7] dark:bg-gray-900">
                    <EmptyState
                        message="No services found. Try adjusting your search criteria."
                        icon={Search}
                    />
                </div>
            );
        }

        return (
            <div className="relative h-full">
                <div
                    ref={containerRef}
                    className="scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800
                    hover:scrollbar-thumb-gray-500 dark:hover:scrollbar-thumb-gray-500
                        scroll-padding relative flex flex-col
                        bg-[#F6F6F7] px-2 dark:bg-gray-900 md:pl-0 md:pr-2"
                    style={{
                        height: '100%',
                        overflowY: 'auto',
                        paddingTop: isMobile ? '8px' : '0px',
                        WebkitOverflowScrolling: 'touch',
                        transform: 'translate3d(0,0,0)',
                    }}
                >
                    {onlineResults.length > 0 && frontendFilteredServices.length > 0 && (
                        <button
                            type="button"
                            onClick={scrollToOnlineSection}
                            className="mb-2 flex w-full items-center gap-2 rounded-lg border border-aqua/40 bg-aqua/10
                                px-4 py-2.5 text-left text-sm text-gray-700 transition-colors
                                hover:bg-aqua/20 focus-visible:outline-none focus-visible:ring-2
                                focus-visible:ring-ring dark:text-gray-200 md:mb-4"
                        >
                            <Globe className="size-4 shrink-0 text-gray-500 dark:text-gray-400" />
                            <span className="flex-1">
                                {t('online_banner', { count: onlineResults.length })}
                            </span>
                            <ArrowDown className="size-4 shrink-0 text-gray-500 dark:text-gray-400" />
                        </button>
                    )}

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
                            onScroll={offset =>
                                setShowScrollButton(offset > SCROLL_TO_TOP_THRESHOLD_PX)
                            }
                        >
                            {renderServiceCards()}
                        </VList>
                    )}
                </div>

                {showScrollButton && (
                    <Button
                        type="button"
                        variant="green"
                        onClick={handleScrollToTop}
                        aria-label={t('scroll_to_top')}
                        className="absolute bottom-4 right-4 z-10 text-white shadow-lg
                            transition-transform duration-150 active:scale-90"
                    >
                        <ArrowUp />
                    </Button>
                )}
            </div>
        );
    },
);

MapList.displayName = 'MapList';
