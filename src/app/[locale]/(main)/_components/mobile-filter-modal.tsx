// components/MobileFilterModal.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { categories, lockScroll, unlockScroll } from '@/lib/consts';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ButtonCategory } from './button-category/button-category';

interface MobileFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedCounty: string;
    onCountyChange: (query: string) => void;
    resetAllFilters: () => void;
    clearCategories: () => void;
}

export const MobileFilterModal = ({
                                      isOpen,
                                      onClose,
                                      selectedCategory,
                                      onCategoryChange,
                                      searchQuery,
                                      onSearchChange,
                                      selectedCounty,
                                      onCountyChange,
                                      resetAllFilters,
                                      clearCategories
                                  }: MobileFilterModalProps) => {
    const t = useTranslations('MapPage');
    const containerRef = useRef<HTMLDivElement>(null);

    // Lock background scroll when open
    useEffect(() => {
        if (isOpen) lockScroll();
        else unlockScroll();
        return () => { unlockScroll(); };
    }, [isOpen]);

    // Toggle category
    const handleCategoryClick = (category: string) => {
        const newCat =
            selectedCategory.toLowerCase() === category.toLowerCase()
                ? ''
                : category;
        onCategoryChange(newCat.toLowerCase());
    };

    return (
        <div
            // This overlay covers the whole screen, darkens it, and closes on click
            className={`
        fixed inset-0 z-[999] flex items-center justify-center
        bg-black/60 backdrop-blur-sm
        transition-opacity duration-300
        ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}
      `}
            onClick={onClose}
        >
            <div
                // The actual modal—stops clicks from bubbling up to the overlay
                ref={containerRef}
                onClick={e => e.stopPropagation()}
                 // eslint-disable-next-line tailwindcss/no-contradicting-classname
                className={`
          relative mx-auto my-4 w-11/12 max-w-md rounded-lg
          bg-white shadow-lg transition-opacity transition-transform
          duration-300 dark:bg-gray-800 dark:shadow-gray-900/50
          ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
                style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div className="flex-none items-center gap-3 border-b border-slate-200 p-4 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            aria-label="Go Back"
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2 className="text-lg font-medium text-slate-800 dark:text-gray-100">
                            {t('Filters')}
                        </h2>
                    </div>
                </div>

                {/* Body */}
                <div className="grow overflow-y-auto p-4">
                    {/* (Optional) insert search and county selects here */}

                    <div className="mt-2 flex flex-col gap-y-1.5">
                        <ButtonCategory
                            image={'/icons/remove.svg'}
                            text={t('Categories.RemoveFilterMobile')}
                            variant={
                                selectedCategory ||
                                (selectedCounty && selectedCounty !== 'all-voivodeships')
                                    ? 'removeFilter'
                                    : 'default'
                            }
                            isSelected={false}
                            onClick={clearCategories}
                            disabled={
                                !selectedCategory &&
                                !searchQuery &&
                                (!selectedCounty || selectedCounty === 'all-voivodeships')
                            }
                        />

                        {categories.map(({ text, key, image, variant }) => (
                            <ButtonCategory
                                key={text}
                                image={image}
                                text={t(`Categories.${text}`)}
                                variant={
                                    selectedCategory
                                        ? key === selectedCategory.toLowerCase()
                                            ? variant
                                            : 'default'
                                        : variant
                                }
                                isSelected={
                                    !!selectedCategory &&
                                    key === selectedCategory.toLowerCase()
                                }
                                onClick={() => handleCategoryClick(key)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
