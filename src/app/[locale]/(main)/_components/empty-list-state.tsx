'use client';

import React, { useCallback } from 'react';
import { Filter, MapPin, Search } from 'lucide-react';
import { useQueryState } from 'nuqs';
import { useTranslations, useLocale } from 'next-intl';
import { localizedMapBasePath } from '@/lib/map-url-builder';
import type { Locale } from '@/i18n/config';

export const EmptyListState = () => {
    const [, setSearchInput] = useQueryState('query', { defaultValue: '' });
    const t = useTranslations('EmptyList');
    const locale = useLocale();

    const resetAllFilters = useCallback(() => {
        // Clear search query param
        setSearchInput(null);

        // Navigate to base map path - use window.location for a clean refresh
        // This is acceptable for the empty state case (edge case)
        const basePath = localizedMapBasePath(locale as Locale);
        window.location.href = basePath;
    }, [setSearchInput, locale]);
    return (
        // eslint-disable-next-line tailwindcss/migration-from-tailwind-2
        <div className="z-10 flex h-full flex-col items-center justify-start bg-[#F6F6F7] bg-opacity-90 p-4 dark:bg-[#111827] dark:bg-opacity-90">
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

                {/* To sa wskazowki, nie kontrolki. Mialy `shadow`, czyli chrome karty
                    klikalnej — uzytkownik probowal w nie klikac, a nic sie nie dzialo.
                    Lista zamiast trzech divow daje tez czytnikowi ekranu informacje,
                    ze to zbior rad, i ile ich jest. */}
                <ul className="mb-6 grid w-full list-none grid-cols-1 gap-4 md:grid-cols-3">
                    <li className="flex flex-col items-center rounded-lg bg-gray-50 p-1 dark:bg-gray-700 md:p-4">
                        <Search
                            aria-hidden="true"
                            className="mb-2 size-4 text-green-500 dark:text-green-400 md:size-6"
                        />
                        <p className="text-sm text-gray-600 dark:text-gray-300">{t('adviceOne')}</p>
                    </li>
                    <li className="flex flex-col items-center rounded-lg bg-gray-50 p-1 dark:bg-gray-700 md:p-4">
                        <Filter
                            aria-hidden="true"
                            className="mb-2 size-4 text-green-500 dark:text-green-400 md:size-6"
                        />
                        <p className="text-sm text-gray-600 dark:text-gray-300">{t('adviceTwo')}</p>
                    </li>
                    <li className="flex flex-col items-center rounded-lg bg-gray-50 p-1 dark:bg-gray-700 md:p-4">
                        <MapPin
                            aria-hidden="true"
                            className="mb-2 size-4 text-green-500 dark:text-green-400 md:size-6"
                        />
                        <p className="text-sm text-gray-600 dark:text-gray-300">{t('adviceThree')}</p>
                    </li>
                </ul>
                <button
                    className="rounded-full bg-green-500 px-6 py-2 font-medium text-white transition-colors hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500"
                    onClick={resetAllFilters}
                >
                    {t('removeAllFilters')}
                </button>
            </div>
        </div>
    );
};