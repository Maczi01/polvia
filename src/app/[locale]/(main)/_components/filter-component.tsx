'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input/input';
import { SelectScrollable } from '@/components/ui/select/select-scrollable';
import { categories, counties } from '@/lib/consts';
import { useQueryState } from 'nuqs';
import { ViewSwitcher } from '@/app/[locale]/(main)/_components/view-switcher/view-switcher';
import { Button } from '@/components/ui/button/button';
import { ButtonCategory } from '@/app/[locale]/(main)/_components/button-category/button-category';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from '@/i18n/navigation';
import { buildMapUrl, localizeMapPath } from '@/lib/map-url-builder';
import type { MapFilters } from '@/lib/map-slug-parser';
import type { Locale } from '@/i18n/config';

const MobileFilterModal = dynamic(
    () =>
        import('@/app/[locale]/(main)/_components/mobile-filter-modal').then(
            mod => mod.MobileFilterModal,
        ),
    { ssr: false },
);

type FilterComponentProps = {
    initialFilters?: MapFilters;
    onFiltersChange?: (filters: MapFilters) => void;
};

export function FilterComponent({ initialFilters, onFiltersChange }: FilterComponentProps) {
    const t = useTranslations('MapPage');
    const locale = useLocale() as Locale;
    const router = useRouter();

    // Category and county now managed via router navigation (slug-based)
    const [selectedCategory, setSelectedCategory] = useState(initialFilters?.category || null);
    const [selectedCounty, setSelectedCounty] = useState(initialFilters?.county || null);
    const [selectedCity, setSelectedCity] = useState(initialFilters?.city || null);

    // Keep query params for search, id, and view
    const [searchInput, setSearchInput] = useQueryState('query', { defaultValue: '' });
    const [selectedId, setSelectedId] = useQueryState('id', { defaultValue: '' });

    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const categoryReference = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);
    const [isScrollable, setIsScrollable] = useState(false);

    // Sync state when URL changes (browser back/forward or direct navigation)
    useEffect(() => {
        setSelectedCategory(initialFilters?.category || null);
        setSelectedCounty(initialFilters?.county || null);
        setSelectedCity(initialFilters?.city || null);
    }, [initialFilters?.category, initialFilters?.county, initialFilters?.city]);

    // Update URL with new filters WITHOUT navigation (instant, client-side only)
    const navigateWithFilters = useCallback(
        (category: string | null, county: string | null, city: string | null = null) => {
            // Update local state immediately for instant UI feedback
            setSelectedCategory(category as any);
            setSelectedCounty(county as any);
            setSelectedCity(city);

            // Notify parent component of filter changes
            onFiltersChange?.({ category: category as any, county: county as any, city });

            // Build the new URL path (localized for browser URL bar)
            const url = buildMapUrl({ category, county, city }, locale);
            const localizedPath = localizeMapPath(url.pathname, locale);
            const basePath = locale === 'pl' ? '' : '/en';
            const fullPath = `${basePath}${localizedPath}`;

            // Update URL without navigation (instant, no reload)
            window.history.pushState({}, '', fullPath);
        },
        [locale, onFiltersChange],
    );

    const resetAllFilters = useCallback(() => {
        // Clear query params
        setSearchInput(null);
        setSelectedId(null);

        // Clear filter state immediately
        setSelectedCategory(null);
        setSelectedCounty(null);
        setSelectedCity(null);

        // Notify parent component of filter changes
        onFiltersChange?.({ category: null, county: null, city: null });

        // Update URL to base path without navigation
        const basePath = locale === 'pl' ? '/mapa' : '/en/map';
        window.history.pushState({}, '', basePath);
    }, [setSearchInput, setSelectedId, locale, onFiltersChange]);

    const clearCategories = useCallback(() => {
        // Navigate to update URL (state will sync via useEffect)
        navigateWithFilters(null, selectedCounty, selectedCity);
    }, [navigateWithFilters, selectedCounty, selectedCity]);

    // Category selection handler
    const handleCategoryClick = (category: string) => {
        const newCategory =
            selectedCategory?.toLowerCase() === category.toLowerCase() ? null : category.toLowerCase();
        // Navigate to update URL (state will sync via useEffect)
        navigateWithFilters(newCategory, selectedCounty, selectedCity);
    };

    // County/City selection handler
    const handleCountyChange = (value: string) => {
        if (value === 'all-voivodeships' || !value) {
            navigateWithFilters(selectedCategory, null, null);
            return;
        }

        if (value.startsWith('city:')) {
            const cityName = value.slice(5);
            navigateWithFilters(selectedCategory, null, cityName);
        } else {
            navigateWithFilters(selectedCategory, value.toLowerCase(), null);
        }
    };

    // Scroll button handlers
    const updateScrollState = useCallback((element: HTMLDivElement) => {
        const { scrollLeft, scrollWidth, clientWidth } = element;
        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
        setIsScrollable(scrollWidth > clientWidth);
    }, []);

    const handleScroll = useCallback(
        (event: Event) => {
            updateScrollState(event.target as HTMLDivElement);
        },
        [updateScrollState],
    );

    const handleResize = useCallback(() => {
        if (categoryReference.current) {
            updateScrollState(categoryReference.current);
        }
    }, [updateScrollState]);

    // Handle mouse wheel event for horizontal scrolling
    const handleWheel = useCallback(
        (event: WheelEvent) => {
            if (!categoryReference.current) return;

            // Prevent the default vertical scroll
            event.preventDefault();

            // Scroll horizontally instead (using deltaY for horizontal movement)
            categoryReference.current.scrollBy({
                left: event.deltaY,
                behavior: 'smooth',
            });

            // Update scroll buttons state
            updateScrollState(categoryReference.current);
        },
        [updateScrollState],
    );

    useEffect(() => {
        const currentReference = categoryReference.current;
        if (currentReference) {
            // Add wheel event listener with { passive: false } to allow preventDefault()
            currentReference.addEventListener('wheel', handleWheel, { passive: false });
            currentReference.addEventListener('scroll', handleScroll, { passive: true });
            updateScrollState(currentReference);
            window.addEventListener('resize', handleResize, { passive: true });
        }
        return () => {
            if (currentReference) {
                currentReference.removeEventListener('wheel', handleWheel);
                currentReference.removeEventListener('scroll', handleScroll);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [handleScroll, handleResize, updateScrollState, handleWheel]);

    const scrollLeft = useCallback(() => {
        categoryReference.current?.scrollBy({ left: -200, behavior: 'smooth' });
    }, []);

    const scrollRight = useCallback(() => {
        categoryReference.current?.scrollBy({ left: 200, behavior: 'smooth' });
    }, []);

    const hasActiveFilters = selectedCategory || searchInput || selectedCounty || selectedCity;

    return (
        <>
            <MobileFilterModal
                isOpen={isMobileFilterOpen}
                onClose={() => setIsMobileFilterOpen(false)}
                selectedCategory={selectedCategory || ''}
                selectedCounty={selectedCity ? `city:${selectedCity}` : selectedCounty || ''}
                onCategoryChange={(category) => {
                    const newCategory = category?.toLowerCase() || null;
                    // Navigate to update URL (state will sync via useEffect)
                    navigateWithFilters(newCategory, selectedCounty, selectedCity);
                }}
                onCountyChange={handleCountyChange}
                onSearchChange={setSearchInput}
                searchQuery={searchInput || ''}
                resetAllFilters={resetAllFilters}
                clearCategories={clearCategories}
            />


            {/* Desktop Filters - unchanged */}

                        {!isMobileFilterOpen && (
                            <>
                                <div className="fixed top-20 left-0 right-0 z-[9] flex flex-col py-0 md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                                        {/* First row - Search and County */}
                                        <div className="flex h-12 flex-row items-center justify-between gap-x-4 px-2">
                                            <div className="w-1/2">
                                                <Input
                                                    value={searchInput || ''}
                                                    onChange={event => setSearchInput(event.target.value)}
                                                    icon
                                                    clearable={true}
                                                    className="w-full"
                                                    placeholder={t('search')}
                                                    onClear={() => {
                                                        setSelectedId(null);
                                                        setSearchInput(null);
                                                    }}
                                                />
                                            </div>
                                            <div className="w-1/2">
                                                <SelectScrollable
                                                    onValueChange={handleCountyChange}
                                                    options={counties}
                                                    value={selectedCity ? `city:${selectedCity}` : selectedCounty || ''}
                                                    placeholder={t('selectCounty')}
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>

                                        {/* Second row - View Switcher and Filter Buttons */}
                                        <div className="flex h-12 flex-row items-center justify-between gap-x-4 px-2">
                                            <ViewSwitcher />

                                            {/* Reset Filter Button - only shown when filters are active */}
                                            <div className="flex w-1/2 gap-x-1">
                                                {hasActiveFilters && (
                                                    <Button
                                                        variant="destructive"
                                                        className="flex h-10 w-1/2 items-center gap-x-2"
                                                        onClick={resetAllFilters}
                                                    >
                                                        <Image
                                                            src="/icons/remove.svg"
                                                            alt="Reset"
                                                            className="size-4"
                                                            width={16}
                                                            height={16}
                                                        />
                                                        {t('Categories.Remove')}
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="slate"
                                                    className={`h-10 ${hasActiveFilters ? 'w-1/2' : 'w-full'} text-white`}
                                                    onClick={() => setIsMobileFilterOpen(true)}
                                                >
                                                    {t('filter')}
                                                </Button>
                                            </div>
                                        </div>
                                </div>

                                {/* Spacer to push content down when filters are fixed */}
                                <div className="h-24 md:hidden" />
                            </>
                        )}




            <div className="hidden md:block">
                <div className="w-full max-w-full bg-[#F6F6F7] dark:bg-[#111827] overflow-x-hidden px-3 pb-4 pt-2">
                    <div className="flex flex-row flex-nowrap items-center gap-x-4">
                        <div className="flex w-1/4 flex-none items-center gap-x-4">
                            <div className="w-1/2">
                                <Input
                                    value={searchInput || ''}
                                    onChange={event => setSearchInput(event.target.value)}
                                    icon
                                    clearable={true}
                                    className="w-full"
                                    placeholder={t('search')}
                                    onClear={() => {
                                        setSelectedId(null);
                                        setSearchInput(null);
                                    }}
                                />
                            </div>
                            <div className="w-1/2">
                                <SelectScrollable
                                    value={selectedCity ? `city:${selectedCity}` : selectedCounty || ''}
                                    onValueChange={handleCountyChange}
                                    options={counties}
                                    placeholder={t('selectCounty')}
                                    className="w-36 md:w-full"
                                />
                            </div>
                        </div>

                        <div className="flex w-3/4 min-w-0 items-center">
                            {isScrollable && (
                                <button
                                    className="flex-none rounded-full border border-gray-200 bg-white p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                                    onClick={scrollLeft}
                                    disabled={!showLeftArrow}
                                    type="button"
                                >
                                    <ArrowLeft
                                        size={20}
                                        className={
                                            showLeftArrow
                                                ? 'text-gray-900 dark:text-gray-100'
                                                : 'text-gray-300 dark:text-gray-500'
                                        }
                                    />
                                </button>
                            )}

                            <div
                                ref={categoryReference}
                                className="scrollbar-hide flex min-w-0 flex-1 gap-x-4 overflow-hidden px-4"
                            >
                                <ButtonCategory
                                    image={'/icons/remove.svg'}
                                    text={t('Categories.RemoveFilter')}
                                    variant={hasActiveFilters ? 'removeFilter' : 'default'}
                                    isSelected={false}
                                    onClick={resetAllFilters}
                                    className="flex-none"
                                    disabled={!hasActiveFilters}
                                />

                                {categories.map(({ text, image, variant }) => (
                                    <ButtonCategory
                                        key={text}
                                        image={image}
                                        text={t(`Categories.${text}`)}
                                        variant={
                                            selectedCategory
                                                ? text.toLowerCase() ===
                                                selectedCategory.toLowerCase()
                                                    ? variant
                                                    : 'default'
                                                : variant
                                        }
                                        isSelected={
                                            !!selectedCategory &&
                                            text.toLowerCase() === selectedCategory.toLowerCase()
                                        }
                                        onClick={() => handleCategoryClick(text.toLowerCase())}
                                        className="flex-none"
                                    />
                                ))}
                            </div>

                            {isScrollable && (
                                <button
                                    className="flex-none rounded-full border border-gray-200 bg-white p-2 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                                    onClick={scrollRight}
                                    disabled={!showRightArrow}
                                    type="button"
                                >
                                    <ArrowRight
                                        size={20}
                                        className={
                                            showRightArrow
                                                ? 'text-gray-900 dark:text-gray-100'
                                                : 'text-gray-300 dark:text-gray-500'
                                        }
                                    />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
