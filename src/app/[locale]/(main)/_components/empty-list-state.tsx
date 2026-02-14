'use client';

import React, { useCallback } from 'react';
import { Filter, MapPin, Search } from 'lucide-react';
import { useQueryState } from 'nuqs';
import { useTranslations, useLocale } from 'next-intl';

export const EmptyListState = () => {
    const [, setSearchInput] = useQueryState('query', { defaultValue: '' });
    const t = useTranslations('EmptyList');
    const locale = useLocale();

    const resetAllFilters = useCallback(() => {
        // Clear search query param
        setSearchInput(null);

        // Navigate to base map path - use window.location for a clean refresh
        // This is acceptable for the empty state case (edge case)
        const basePath = locale === 'pl' ? '/mapa' : '/en/map';
        window.location.href = basePath;
    }, [setSearchInput, locale]);
    return (
        // eslint-disable-next-line tailwindcss/migration-from-tailwind-2
        <div className="z-10 flex h-full flex-col items-center justify-start bg-[#F6F6F7] dark:bg-[#111827] bg-opacity-90 dark:bg-opacity-90 p-4">
            <div className="flex max-w-md flex-col items-center text-center">
                <div className="mb-2 flex size-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 md:mb-4 md:size-16">
                    <MapPin className="size-4 text-green-500 dark:text-green-400 md:size-8" />
                </div>
                <h3 className="text-md mb-2 font-bold text-gray-800 dark:text-gray-100 md:text-xl">
                    {t('title')}
                </h3>
                <p className="mb-2 text-gray-600 dark:text-gray-300 md:mb-6">
                    {t('description')}
                </p>

                <div className="mb-6 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="flex flex-col items-center rounded-lg bg-gray-50 dark:bg-gray-700 p-1 shadow dark:shadow-gray-900/20 md:p-4">
                        <Search className="mb-2 size-4 text-green-500 dark:text-green-400 md:size-6" />
                        <p className="text-sm text-gray-600 dark:text-gray-300">{t('adviceOne')}</p>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-gray-50 dark:bg-gray-700 p-1 shadow dark:shadow-gray-900/20 md:p-4">
                        <Filter className="mb-2 size-4 text-green-500 dark:text-green-400 md:size-6" />
                        <p className="text-sm text-gray-600 dark:text-gray-300">{t('adviceTwo')}</p>
                    </div>
                    <div className="flex flex-col items-center rounded-lg bg-gray-50 dark:bg-gray-700 p-1 shadow dark:shadow-gray-900/20 md:p-4">
                        <MapPin className="mb-2 size-4 text-green-500 dark:text-green-400 md:size-6" />
                        <p className="text-sm text-gray-600 dark:text-gray-300"> {t('adviceThree')}</p>
                    </div>
                </div>
                <button
                    className="rounded-full bg-green-500 dark:bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-600 dark:hover:bg-green-500"
                    onClick={resetAllFilters}
                >
                    {t('removeAllFilters')}
                </button>
            </div>
        </div>
    );
};