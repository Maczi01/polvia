// components/MobileFilterModal.tsx
'use client';

import React, { useEffect, useId, useRef } from 'react';
import { counties, lockScroll, unlockScroll } from '@/lib/consts';
import { CATEGORIES } from '@/lib/categories';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { SelectScrollable } from '@/components/ui/select/select-scrollable';
import { ButtonCategory } from './button-category/button-category';

const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Tab na ostatniej kontrolce wraca na pierwszą, Shift+Tab na pierwszej — na ostatnią.
const trapTabKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
    }
    if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};

interface MobileFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedCounty: string;
    onCountyChange: (query: string) => void;
    onlineOnly: boolean;
    onOnlineToggle: () => void;
    resetAllFilters: () => void;
    clearCategories: () => void;
    /** Liczba kart na kategorie przy pozostalych aktywnych filtrach. */
    categoryCounts?: Record<string, number>;
    /**
     * Suma kart przy AKTUALNYCH filtrach — etykieta przycisku w stopce.
     * Wymagana: jedyny rodzic zawsze ja liczy, a wariant „bez liczby" dawal
     * stopce te sama nazwe co strzalce w naglowku (dwa „Zamknij filtry").
     */
    totalCount: number;
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
                                      onlineOnly,
                                      onOnlineToggle,
                                      resetAllFilters,
                                      clearCategories,
                                      categoryCounts,
                                      totalCount,
                                  }: MobileFilterModalProps) => {
    const t = useTranslations('MapPage');
    const containerRef = useRef<HTMLDivElement>(null);
    const backButtonRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();

    // Lock background scroll when open
    useEffect(() => {
        if (isOpen) lockScroll();
        else unlockScroll();
        return () => { unlockScroll(); };
    }, [isOpen]);

    // Move focus into the dialog so Escape and the Tab trap work right away
    useEffect(() => {
        if (isOpen) backButtonRef.current?.focus();
    }, [isOpen]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key === 'Tab') trapTabKey(event);
    };

    // Toggle category. Arkusz NIE zamyka sie po wyborze: kategoria, zasieg,
    // lokalizacja i tekst stoja tu obok siebie, wiec zamkniecie po pierwszym
    // tapnieciu odbieraloby mozliwosc ustawienia reszty. Wyjsciem jest stopka.
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
            // Closed modal stays mounted for the opacity transition — inert removes it
            // from the Tab order and the accessibility tree, pointer-events only stops the mouse
            inert={!isOpen}
        >
            <div
                // The actual modal—stops clicks from bubbling up to the overlay
                ref={containerRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={e => e.stopPropagation()}
                onKeyDown={handleKeyDown}
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
                            ref={backButtonRef}
                            onClick={onClose}
                            aria-label={t('closeFilters')}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2
                            id={titleId}
                            className="text-lg font-medium text-slate-800 dark:text-gray-100"
                        >
                            {t('Filters')}
                        </h2>
                    </div>
                </div>

                {/* Body */}
                <div className="grow overflow-y-auto p-4">
                    <div className="flex flex-col gap-y-3">
                        <Input
                            value={searchQuery}
                            onChange={event => onSearchChange(event.target.value)}
                            icon
                            clearable
                            aria-label={t('search')}
                            placeholder={t('search')}
                            onClear={() => onSearchChange('')}
                        />

                        <SelectScrollable
                            options={counties}
                            value={selectedCounty}
                            onValueChange={onCountyChange}
                            placeholder={t('selectCounty')}
                            ariaLabel={t('selectCounty')}
                            className="w-full"
                        />
                    </div>

                    <div className="mt-3 flex flex-col gap-y-1.5">
                        <ButtonCategory
                            image={'/icons/remove.svg'}
                            text={t('Categories.RemoveFilterMobile')}
                            variant={
                                selectedCategory ||
                                (selectedCounty && selectedCounty !== 'all-voivodeships')
                                    ? 'removeFilter'
                                    : 'default'
                            }
                            onClick={clearCategories}
                            disabled={
                                !selectedCategory &&
                                !searchQuery &&
                                !onlineOnly &&
                                (!selectedCounty || selectedCounty === 'all-voivodeships')
                            }
                        />

                        <ButtonCategory
                            image={'/icons/online.svg'}
                            text={t('Categories.Online')}
                            variant={onlineOnly ? 'aqua' : 'default'}
                            isSelected={onlineOnly}
                            onClick={onOnlineToggle}
                        />

                        {CATEGORIES.map(({ text, key, image, variant }) => {
                            const isSelected = key === selectedCategory.toLowerCase();
                            // Pusta kategoria zostaje klikalna, ale gasnie jak niewybrana.
                            const isEmpty = categoryCounts?.[key] === 0;
                            const isColored = isSelected || (!selectedCategory && !isEmpty);
                            return (
                                <ButtonCategory
                                    key={text}
                                    image={image}
                                    text={t(`Categories.${text}`)}
                                    count={categoryCounts?.[key]}
                                    variant={isColored ? variant : 'default'}
                                    isSelected={isSelected}
                                    onClick={() => handleCategoryClick(key)}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Stopka: jedyne wyjscie z arkusza poza Escape i tapnieciem tla.
                    Liczba mowi, co uzytkownik zobaczy po zamknieciu — filtr dziala
                    natychmiast, wiec bez niej tapniecie kategorii nie daje zadnej
                    informacji zwrotnej spod zakrywajacego ekran arkusza. */}
                <div className="flex-none border-t border-slate-200 p-4 dark:border-gray-600">
                    <Button variant="default" className="w-full" onClick={onClose}>
                        {t('showResults', { count: totalCount })}
                    </Button>
                </div>
            </div>
        </div>
    );
};
