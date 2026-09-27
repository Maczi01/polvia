import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { NextIntlClientProvider } from 'next-intl';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

import { MapPageClient } from './map-page-client';
import messages from '../../../../../messages/pl.json';
import type { MapFilters } from '@/lib/map-slug-parser';
import type { Service } from '@/types';

// react-map-gl to zewnetrzna biblioteka WebGL, ktorej jsdom nie uruchomi. Mapa
// renderuje dzieci (markery), a ref wystawia tylko metody wolane przez OverviewMap;
// getMap zwraca null, wiec wszystkie galezie `if (mapRef.current?.getMap())`
// sie pomijaja. mapbox-gl nie wymaga mocka — kod importuje z niego tylko typy i CSS.
jest.mock('react-map-gl/mapbox', () => {
    const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
    type ChildrenProps = { children?: ReactNode };
    const Map = forwardRef<unknown, ChildrenProps>(({ children }, ref) => {
        useImperativeHandle(ref, () => ({
            getMap: () => null,
            fitBounds: jest.fn(),
            flyTo: jest.fn(),
            resize: jest.fn(),
        }));
        return <div>{children}</div>;
    });
    Map.displayName = 'MapStub';
    const Passthrough = ({ children }: ChildrenProps): ReactNode => children;
    return { __esModule: true, default: Map, Marker: Passthrough, Popup: Passthrough };
});

let counter = 0;

function service(overrides: Partial<Service> = {}): Service {
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

const SERVICES = [
    service({ name: 'Kancelaria Prawna', category: 'law' }),
    service({ name: 'Biuro Rachunkowe', category: 'financial' }),
];

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

async function renderMapPage(pathname: string, initialFilters: MapFilters): Promise<void> {
    window.history.replaceState({}, '', pathname);
    // Mapa i modal filtrow ida przez next/dynamic (React.lazy) — async act czeka,
    // az leniwe moduly sie rozwiaza, zanim test zacznie asercje.
    await act(async () => {
        render(
            <AppRouterContext.Provider value={ROUTER_STUB}>
                <NextIntlClientProvider locale="pl" messages={messages}>
                    <NuqsTestingAdapter>
                        <MapPageClient services={SERVICES} initialFilters={initialFilters} />
                    </NuqsTestingAdapter>
                </NextIntlClientProvider>
            </AppRouterContext.Provider>,
        );
    });
}

// Tak robi przegladarka przy Wstecz/Naprzod: adres jest juz zmieniony, gdy
// przychodzi popstate. Nawigacji Next nie ma, wiec initialFilters sie nie zmienia.
function navigateHistoryTo(pathname: string): void {
    act(() => {
        window.history.pushState({}, '', pathname);
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
}

const NO_FILTERS: MapFilters = { category: null, county: null, city: null, onlineOnly: false };
const LAW_FILTERS: MapFilters = { ...NO_FILTERS, category: 'law' };

function renderedResultNames(): string[] {
    return SERVICES.map(({ name }) => name).filter(name => screen.queryByText(name) !== null);
}

// Nazwa dostepna to "icon Usuń filtry" (alt ikony + tekst). Kotwica `$` odcina
// przycisk modala "Usuń filtry kategorii".
function removeFiltersButton(): HTMLElement {
    return screen.getByRole('button', { name: /Usuń filtry$/ });
}

describe('<MapPageClient /> — Wstecz/Naprzod w przegladarce', () => {
    beforeAll(() => {
        // Modal filtrow zdejmuje blokade scrolla przez window.scrollTo, ktorego jsdom
        // nie implementuje. Bez restore — tak jak w mobile-filter-modal.test.tsx.
        jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    beforeEach(() => {
        // jsdom nie implementuje matchMedia (useMediaQuery listy wynikow).
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
    });

    it('powrot z /mapa/prawne na /mapa czysci filtr na liscie wynikow ORAZ w pasku filtrow', async () => {
        await renderMapPage('/mapa/prawne', LAW_FILTERS);
        expect(renderedResultNames()).toEqual(['Kancelaria Prawna']);
        expect(removeFiltersButton()).toBeEnabled();

        navigateHistoryTo('/mapa');

        expect(renderedResultNames()).toEqual(['Kancelaria Prawna', 'Biuro Rachunkowe']);
        expect(removeFiltersButton()).toBeDisabled();
    });

    it('przejscie z /mapa na /mapa/prawne naklada filtr na liste wynikow ORAZ na pasek filtrow', async () => {
        await renderMapPage('/mapa', NO_FILTERS);
        expect(renderedResultNames()).toEqual(['Kancelaria Prawna', 'Biuro Rachunkowe']);
        expect(removeFiltersButton()).toBeDisabled();

        navigateHistoryTo('/mapa/prawne');

        expect(renderedResultNames()).toEqual(['Kancelaria Prawna']);
        expect(removeFiltersButton()).toBeEnabled();
    });
});
