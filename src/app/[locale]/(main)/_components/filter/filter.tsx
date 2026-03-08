'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { categories, counties } from '@/lib/consts';
import { useTranslations } from 'next-intl';
import { SelectScrollable } from '@/components/ui/select/select-scrollable';
import { ButtonCategory } from '../button-category/button-category';
import { Input } from '@/components/ui/input/input';

type FilterProperties = {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedCounty: string;
    onCountyChange: (query: string) => void;
    selectedCategory: string;
    onCategoryChange: (categories: string) => void;
    resetAllFilters: () => void;
};

export const Filter = memo(
    ({
        searchQuery,
        onSearchChange,
        selectedCounty,
        onCountyChange,
        selectedCategory,
        onCategoryChange,
        resetAllFilters,
    }: FilterProperties) => {
        const categoryReference = useRef<HTMLDivElement>(null);
        const [showLeftArrow, setShowLeftArrow] = useState(false);
        const [showRightArrow, setShowRightArrow] = useState(true);
        const [isScrollable, setIsScrollable] = useState(false);
        const [isPending, startTransition] = useTransition();
        const t = useTranslations('MapPage');

        const updateScrollState = useCallback((element: HTMLDivElement) => {
            const { scrollLeft, scrollWidth, clientWidth } = element;
            setShowLeftArrow(scrollLeft > 0);
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
            setIsScrollable(scrollWidth > clientWidth);
        }, []);

        const handleCategoryClick = (category: string) => {
            const newCategory =
                selectedCategory.toLowerCase() === category.toLowerCase() ? '' : category;
            onCategoryChange(newCategory.toLowerCase());
        };

        const handleResetFilters = useCallback(() => {
            startTransition(() => {
                resetAllFilters();
            });
        }, [onSearchChange, onCountyChange, onCategoryChange]);

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

        useEffect(() => {
            const currentReference = categoryReference.current;
            if (currentReference) {
                currentReference.addEventListener('scroll', handleScroll, { passive: true });
                updateScrollState(currentReference);
                window.addEventListener('resize', handleResize, { passive: true });
            }
            return () => {
                if (currentReference) {
                    currentReference.removeEventListener('scroll', handleScroll);
                }
                window.removeEventListener('resize', handleResize);
            };
        }, [handleScroll, handleResize, updateScrollState]);

        const scrollLeft = useCallback(() => {
            categoryReference.current?.scrollBy({ left: -200, behavior: 'smooth' });
        }, []);

        const scrollRight = useCallback(() => {
            categoryReference.current?.scrollBy({ left: 200, behavior: 'smooth' });
        }, []);

        const hasActiveFilters =
            selectedCategory ||
            searchQuery ||
            (selectedCounty && selectedCounty !== 'all-voivodeships');

        return (
            <div className="w-full max-w-full overflow-x-hidden px-3 pb-4 pt-2">
                <div className="flex flex-row flex-nowrap items-center gap-x-4">
                    {/* Input and Select Section (unchanged) */}
                    <div className="flex w-1/4 flex-none items-center gap-x-4">
                        <div className="w-1/2">
                            <Input
                                value={searchQuery}
                                onChange={event => onSearchChange(event.target.value)}
                                icon
                                className="w-full"
                                placeholder={t('search')}
                            />
                        </div>
                        <div className="w-1/2">
                            <SelectScrollable
                                value={selectedCounty}
                                onValueChange={onCountyChange}
                                options={counties}
                                placeholder={t('selectCounty')}
                                className="w-36 md:w-full"
                            />
                        </div>
                    </div>

                    <div className="flex w-3/4 min-w-0 items-center">
                        {isScrollable && (
                            <button
                                className="flex-none rounded-full border border-gray-200 bg-white p-2 transition-colors hover:bg-gray-50"
                                onClick={scrollLeft}
                                disabled={!showLeftArrow}
                                type="button"
                            >
                                <ArrowLeft
                                    size={20}
                                    className={showLeftArrow ? '' : 'text-gray-300'}
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
                                onClick={handleResetFilters}
                                className="flex-none"
                                disabled={!hasActiveFilters}
                            />

                            {categories.map(({ text, key, image, variant }) => (
                                <ButtonCategory
                                    key={text}
                                    image={image}
                                    text={t(`Categories.${text}`)}
                                    variant={
                                        selectedCategory
                                            ? (key === selectedCategory.toLowerCase()
                                                ? variant
                                                : 'default')
                                            : variant
                                    }
                                    isSelected={
                                        !!selectedCategory &&
                                        key === selectedCategory.toLowerCase()
                                    }
                                    onClick={() => handleCategoryClick(key)}
                                    className="flex-none"
                                />
                            ))}
                        </div>

                        {isScrollable && (
                            <button
                                className="flex-none rounded-full border border-gray-200 bg-white p-2 transition-colors hover:bg-gray-50"
                                onClick={scrollRight}
                                disabled={!showRightArrow}
                                type="button"
                            >
                                <ArrowRight
                                    size={20}
                                    className={showRightArrow ? '' : 'text-gray-300'}
                                />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    },
);

Filter.displayName = 'Filter';
