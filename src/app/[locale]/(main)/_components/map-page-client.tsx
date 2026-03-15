'use client';

import { useState, useEffect } from 'react';
import { FilterComponent } from './filter-component';
import { ServicesClientComponent } from './services-client-component';
import type { MapFilters } from '@/lib/map-slug-parser';
import type { Service } from '@/types';

interface MapPageClientProps {
    services: Service[];
    initialFilters?: MapFilters;
}

export function MapPageClient({ services, initialFilters }: MapPageClientProps) {
    // Manage filter state at this level so both FilterComponent and ServicesClientComponent can access it
    const [currentFilters, setCurrentFilters] = useState<MapFilters>(
        initialFilters || { category: null, county: null, city: null }
    );

    // Sync with initial filters when they change (browser back/forward)
    useEffect(() => {
        setCurrentFilters(initialFilters || { category: null, county: null, city: null });
    }, [initialFilters]);

    return (
        <>
            {/* Filter Component */}
            <div className="top-0 bg-white shadow-md dark:bg-gray-900 md:shadow-none">
                <FilterComponent
                    initialFilters={initialFilters}
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
