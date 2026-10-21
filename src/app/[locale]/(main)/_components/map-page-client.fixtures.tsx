import { act, render } from '@testing-library/react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { NextIntlClientProvider } from 'next-intl';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

import { MapPageClient } from './map-page-client';
import messages from '../../../../../messages/pl.json';
import type { MapFilters } from '@/lib/map-slug-parser';
import type { Service } from '@/types';

/*
 * Wspolne fixtures testow `<MapPageClient />` (kilka plikow, zeby zaden nie przekroczyl
 * 300 linii). `jest.mock('react-map-gl/mapbox')` zostaje w kazdym pliku testu — Jest
 * hoistuje go tylko w module testu.
 */

let counter = 0;

export function service(overrides: Partial<Service> = {}): Service {
    counter += 1;
    return {
        id: `id-${counter}`,
        serviceId: `service-${counter}`,
        slug: `slug-${counter}`,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        name: `Usluga ${counter}`,
        description: null,
        category: 'financial',
        coverage: 'local',
        tags: null,
        city: 'Warszawa',
        street: null,
        voivodeship: 'mazowieckie',
        postcode: null,
        latitude: 52.2297,
        longitude: 21.0122,
        openingHours: {},
        phoneNumber: null,
        email: null,
        webpage: null,
        image: null,
        languages: ['pl'],
        socials: null,
        whatsappNumber: null,
        verified: false,
        priority: 0,
        clicks: 0,
        ...overrides,
    };
}

// Filtry nie nawiguja routerem (pushState), wiec router tylko musi istniec —
// useRouter z next/navigation rzuca bez zamontowanego App Routera.
const ROUTER_STUB = {
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
};

type RenderOptions = {
    /** Query string widziany przez nuqs, np. `?lang=ru`. */
    searchParams?: string;
    locale?: string;
};

export async function renderMapPage(
    pathname: string,
    initialFilters: MapFilters,
    services: Service[],
    { searchParams = '', locale = 'pl' }: RenderOptions = {},
): Promise<void> {
    window.history.replaceState({}, '', `${pathname}${searchParams}`);
    // Mapa i modal filtrow ida przez next/dynamic (React.lazy) — async act czeka,
    // az leniwe moduly sie rozwiaza, zanim test zacznie asercje.
    await act(async () => {
        render(
            <AppRouterContext.Provider value={ROUTER_STUB}>
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <NuqsTestingAdapter searchParams={searchParams}>
                        <MapPageClient services={services} initialFilters={initialFilters} />
                    </NuqsTestingAdapter>
                </NextIntlClientProvider>
            </AppRouterContext.Provider>,
        );
    });
}

export const NO_FILTERS: MapFilters = {
    category: null,
    county: null,
    city: null,
    onlineOnly: false,
};
export const LAW_FILTERS: MapFilters = { ...NO_FILTERS, category: 'law' };

/** jsdom nie implementuje matchMedia (useMediaQuery listy wynikow). */
export function stubMatchMedia(): void {
    window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
    }));
}
