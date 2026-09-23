'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { FilterComponent } from './filter-component';
import { ServicesClientComponent } from './services-client-component';
import type { Locale } from '@/i18n/config';
import { mapFiltersFromPathname } from '@/lib/map-pathname';
import type { MapFilters } from '@/lib/map-slug-parser';
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
