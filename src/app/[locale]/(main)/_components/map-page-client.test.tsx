import type { ReactNode } from 'react';
import { act, screen } from '@testing-library/react';

import {
    LAW_FILTERS,
    NO_FILTERS,
    renderMapPage as renderWithServices,
    service,
    stubMatchMedia,
} from './map-page-client.fixtures';
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

const SERVICES = [
    service({ name: 'Kancelaria Prawna', category: 'law' }),
    service({ name: 'Biuro Rachunkowe', category: 'financial' }),
];

function renderMapPage(
    pathname: string,
    initialFilters: MapFilters,
    services: Service[] = SERVICES,
): Promise<void> {
    return renderWithServices(pathname, initialFilters, services);
}

// Tak robi przegladarka przy Wstecz/Naprzod: adres jest juz zmieniony, gdy
// przychodzi popstate. Nawigacji Next nie ma, wiec initialFilters sie nie zmienia.
function navigateHistoryTo(pathname: string): void {
    act(() => {
        window.history.pushState({}, '', pathname);
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
}

function renderedResultNames(): string[] {
    return SERVICES.map(({ name }) => name).filter(name => screen.queryByText(name) !== null);
}

// Nazwa dostepna to "icon Usuń filtry" (alt ikony + tekst). Kotwica `$` odcina
// przycisk modala "Usuń filtry kategorii".
function removeFiltersButton(): HTMLElement {
    return screen.getByRole('button', { name: /Usuń filtry$/ });
}

beforeAll(() => {
    // Modal filtrow zdejmuje blokade scrolla przez window.scrollTo, ktorego jsdom
    // nie implementuje. Bez restore — tak jak w mobile-filter-modal.test.tsx.
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

beforeEach(() => {
    stubMatchMedia();
});

describe('<MapPageClient /> — Wstecz/Naprzod w przegladarce', () => {

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

// Regresja: sekcja online celowo nie filtruje po geografii (R5), ale wpisy `hybrid`
// maja wspolrzedne i wchodzily przez nia na mape. Efekt: /mapa/podlaskie pisalo
// "nie znaleziono" i rownoczesnie rysowalo piny z drugiego konca Polski.
describe('<MapPageClient /> — piny respektuja filtr geograficzny', () => {
    const BIALYSTOK = service({
        name: 'Fryzjer Bialystok',
        coverage: 'local',
        city: 'Bialystok',
        voivodeship: 'podlaskie',
        latitude: 53.1325,
        longitude: 23.1688,
    });

    // `hybrid`, bo tylko taki wpis ma jednoczesnie wspolrzedne i wstep do sekcji online.
    const WROCLAW = service({
        name: 'Remonty Wroclaw',
        coverage: 'hybrid',
        city: 'Wroclaw',
        voivodeship: 'dolnoslaskie',
        latitude: 51.1079,
        longitude: 17.0385,
    });

    // Pin to <Image alt="shop icon">, a zlepek pinow — <img alt="cluster icon"> z licznikiem.
    // Marker nie przyjmuje aria-label, wiec po nazwie firmy nie da sie go znalezc.
    const pins = (): HTMLElement[] => screen.queryAllByAltText('shop icon');

    it('filtr wojewodztwa zdejmuje z mapy piny spoza niego', async () => {
        await renderMapPage('/mapa/podlaskie', { ...NO_FILTERS, county: 'podlaskie' }, [
            BIALYSTOK,
            WROCLAW,
        ]);

        expect(pins()).toHaveLength(1);
        expect(screen.queryByAltText('cluster icon')).toBeNull();
    });

    it('bez filtra geograficznego oba wpisy maja pin', async () => {
        await renderMapPage('/mapa', NO_FILTERS, [BIALYSTOK, WROCLAW]);

        expect(pins()).toHaveLength(2);
    });
});

// Na mobile widok mapy zakrywa liste, wiec pusta mapa musi sama powiedziec, czemu
// jest pusta. Dwie przyczyny, dwa zdania — wczesniej padalo zawsze to samo
// ("uslugi sa zdalne"), takze gdy nie bylo zadnych wynikow.
describe('<MapPageClient /> — pusta mapa na mobile tlumaczy swoja pustke', () => {
    const originalWidth = window.innerWidth;

    const WROCLAW_ONLINE = service({
        name: 'Zdalna Ksiegowa',
        coverage: 'hybrid',
        city: 'Wroclaw',
        voivodeship: 'dolnoslaskie',
    });

    const WROCLAW_LOCAL = service({
        name: 'Fryzjer Wroclaw',
        coverage: 'local',
        city: 'Wroclaw',
        voivodeship: 'dolnoslaskie',
    });

    const PODLASKIE: MapFilters = { ...NO_FILTERS, county: 'podlaskie' };

    beforeEach(() => {
        // useIsMobile czyta innerWidth, a jsdom startuje na 1024 — czyli na desktopie,
        // gdzie nakladki celowo nie ma (lista stoi obok mapy).
        Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    });

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
    });

    it('wyniki sa, tylko bez pinow — kieruje na liste', async () => {
        await renderMapPage('/mapa/podlaskie', PODLASKIE, [WROCLAW_ONLINE]);

        expect(screen.getByRole('status')).toHaveTextContent(messages.MapList.map_no_pins);
    });

    it('nie ma zadnych wynikow — mowi to samo, co pusta lista', async () => {
        await renderMapPage('/mapa/podlaskie', PODLASKIE, [WROCLAW_LOCAL]);

        expect(screen.getByRole('status')).toHaveTextContent(messages.EmptyList.description);
    });
});
