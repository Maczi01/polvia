'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useQueryState } from 'nuqs';
import { FilterComponent } from './filter-component';
import { ServicesClientComponent } from './services-client-component';
import type { Locale } from '@/i18n/config';
import { mapFiltersFromPathname } from '@/lib/map-pathname';
import type { MapFilters } from '@/lib/map-slug-parser';
import { countCardsByCategory, countVisibleCards } from '@/lib/result-counts';
import type { Service } from '@/types';

interface MapPageClientProps {
    services: Service[];
    initialFilters?: MapFilters;
}

export function MapPageClient({ services, initialFilters }: MapPageClientProps) {
    const locale = useLocale() as Locale;

    // Manage filter state at this level so both FilterComponent and ServicesClientComponent can access it
    const [currentFilters, setCurrentFilters] = useState<MapFilters>(
        initialFilters || { category: null, county: null, city: null, onlineOnly: false }
    );

    // Sync with server filters when a real navigation delivers new ones
    useEffect(() => {
        setCurrentFilters(initialFilters || { category: null, county: null, city: null, onlineOnly: false });
    }, [initialFilters]);

    const [searchInput] = useQueryState('query', { defaultValue: '' });

    // Liczone tutaj, bo tylko ten komponent ma i uslugi, i komplet filtrow.
    // Ten sam `splitServicesByCoverage`, ktory filtruje liste — liczby nie moga sie rozjechac.
    const categoryCounts = useMemo(
        () => countCardsByCategory(services, { ...currentFilters, query: searchInput }),
        [services, currentFilters, searchInput],
    );

    // Suma dla stanu, w ktorym uzytkownik juz jest — stopka arkusza mobilnego
    // mowi nia, co zobaczy po zamknieciu.
    const totalCount = useMemo(
        () => countVisibleCards(services, { ...currentFilters, query: searchInput }),
        [services, currentFilters, searchInput],
    );

    // Filtry zmieniaja adres przez history.pushState, wiec przy Wstecz/Naprzod
    // serwer nie przysyla nowych initialFilters — odtwarzamy je z samego adresu.
    useEffect(() => {
        const handlePopState = () => {
            setCurrentFilters(mapFiltersFromPathname(window.location.pathname, locale));
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [locale]);

    return (
        <>
            {/* Filter Component */}
            <div className="top-0 bg-white shadow-md dark:bg-gray-900 md:shadow-none">
                <FilterComponent
                    initialFilters={currentFilters}
                    onFiltersChange={setCurrentFilters}
                    categoryCounts={categoryCounts}
                    totalCount={totalCount}
                />
            </div>

            {/* Main Content Area */}
            <div className="min-h-0 flex-1 px-2">
                <ServicesClientComponent
                    services={services}
                    initialFilters={currentFilters}
                />
            </div>
        </>
    );
}
