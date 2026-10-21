import type { ReactNode } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
    LAW_FILTERS,
    NO_FILTERS,
    renderMapPage,
    service,
    stubMatchMedia,
} from './map-page-client.fixtures';
import messages from '../../../../../messages/pl.json';

// react-map-gl to zewnetrzna biblioteka WebGL, ktorej jsdom nie uruchomi — ten sam stub
// co w map-page-client.test.tsx (jest.mock hoistuje sie tylko w module testu).
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

beforeAll(() => {
    // Modal filtrow zdejmuje blokade scrolla przez window.scrollTo, ktorego jsdom
    // nie implementuje. Bez restore — tak jak w mobile-filter-modal.test.tsx.
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

beforeEach(() => {
    stubMatchMedia();
});

// Jezyk obslugi zyje w `?lang` (nuqs), nie w sciezce — i zaweza wszystko naraz (R12).
describe('<MapPageClient /> — filtr jezyka obslugi z ?lang', () => {
    // Rozne miasta, zeby piny nie zlepily sie w klaster.
    const RU_LAW = service({
        name: 'Kancelaria Rosyjska',
        category: 'law',
        languages: ['pl', 'ru'],
    });
    const PL_FINANCIAL = service({
        name: 'Biuro Polskie',
        category: 'financial',
        languages: ['pl'],
        city: 'Gdansk',
        voivodeship: 'pomorskie',
        latitude: 54.352,
        longitude: 18.6466,
    });
    const RU_FINANCIAL = service({
        name: 'Ksiegowa Rosyjska',
        category: 'financial',
        languages: ['ru'],
        city: 'Krakow',
        voivodeship: 'malopolskie',
        latitude: 50.0647,
        longitude: 19.945,
    });
    const UK_LAW = service({
        name: 'Prawnik Ukrainski',
        category: 'law',
        languages: ['uk'],
        city: 'Wroclaw',
        voivodeship: 'dolnoslaskie',
        latitude: 51.1079,
        longitude: 17.0385,
    });
    const CATALOG = [RU_LAW, PL_FINANCIAL, RU_FINANCIAL, UK_LAW];
    const ALL_NAMES = CATALOG.map(({ name }) => name);

    const listedNames = (): string[] => ALL_NAMES.filter(name => screen.queryByText(name) !== null);
    const pins = (): HTMLElement[] => screen.queryAllByAltText('shop icon');
    // Nazwa dostepna przycisku kategorii to etykieta + liczba z `sr-only`, np. "Prawne (1)".
    // Przycisk jest dwa razy: w pasku desktop i w arkuszu mobilnym — oba licza to samo.
    const categoryButtonsNamed = (name: string): HTMLElement[] =>
        screen.queryAllByRole('button', { name });
    const desktopCategoryButton = (label: string): HTMLElement => {
        const [button] = screen.getAllByRole('button', { name: new RegExp(`^${label} `) });
        return button;
    };

    it('?lang=ru zostawia na liscie i na mapie tylko wpisy z jezykiem ru', async () => {
        await renderMapPage('/mapa', NO_FILTERS, CATALOG, { searchParams: '?lang=ru' });

        expect(listedNames()).toEqual(['Kancelaria Rosyjska', 'Ksiegowa Rosyjska']);
        expect(pins()).toHaveLength(2);
    });

    it('liczniki kategorii licza tylko wpisy w wybranym jezyku', async () => {
        await renderMapPage('/mapa', NO_FILTERS, CATALOG, { searchParams: '?lang=ru' });

        // Bez jezyka bylyby po 2 — po jednej karcie z ru w kazdej kategorii.
        expect(categoryButtonsNamed('Prawne (1)')).toHaveLength(2);
        expect(categoryButtonsNamed('Finansowe (1)')).toHaveLength(2);
    });

    it('licznik kategorii zgadza sie z liczba kart po jej wybraniu', async () => {
        await renderMapPage('/mapa/prawne', LAW_FILTERS, CATALOG, { searchParams: '?lang=ru' });

        expect(listedNames()).toEqual(['Kancelaria Rosyjska']);
        expect(categoryButtonsNamed('Prawne (1)')).toHaveLength(2);
    });

    it('nieznany kod ?lang=xx to brak filtra — pelna lista (R10)', async () => {
        await renderMapPage('/mapa', NO_FILTERS, CATALOG, { searchParams: '?lang=xx' });

        expect(listedNames()).toEqual(ALL_NAMES);
        expect(pins()).toHaveLength(4);
        expect(categoryButtonsNamed('Prawne (2)')).toHaveLength(2);
    });

    it('locale uk bez ?lang nie zaweza wynikow (R11)', async () => {
        await renderMapPage('/uk/map', NO_FILTERS, CATALOG, { locale: 'uk' });

        expect(listedNames()).toEqual(ALL_NAMES);
        expect(pins()).toHaveLength(4);
    });

    it('klik kategorii zmienia sciezke i zachowuje ?lang w adresie', async () => {
        await renderMapPage('/mapa', NO_FILTERS, CATALOG, { searchParams: '?lang=ru' });

        act(() => {
            fireEvent.click(desktopCategoryButton('Prawne'));
        });

        expect(window.location.pathname).toBe('/mapa/prawne');
        expect(window.location.search).toBe('?lang=ru');
        expect(listedNames()).toEqual(['Kancelaria Rosyjska']);
    });

    const languageSelects = (): HTMLElement[] =>
        screen.getAllByRole('combobox', { name: messages.MapPage.languageFilter });

    async function pickLanguage(select: HTMLElement, optionName: RegExp): Promise<void> {
        await userEvent.click(select);
        await userEvent.click(screen.getByRole('option', { name: optionName }));
    }

    it('wybor jezyka w pasku desktop zaweza liste, a „Usuń filtry" ja przywraca (R13)', async () => {
        await renderMapPage('/mapa', NO_FILTERS, CATALOG);
        const [desktopSelect] = languageSelects();

        await pickLanguage(desktopSelect, /^Русский/);
        expect(listedNames()).toEqual(['Kancelaria Rosyjska', 'Ksiegowa Rosyjska']);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Usuń filtry$/ }));
        });
        expect(listedNames()).toEqual(ALL_NAMES);
        expect(languageSelects()[0]).toHaveTextContent(messages.MapPage.anyLanguage);
    });

    it('stopka arkusza liczy karty przy ?lang', async () => {
        await renderMapPage('/mapa', NO_FILTERS, CATALOG, { searchParams: '?lang=ru' });

        expect(screen.getByRole('button', { name: 'Pokaż 2 wyniki' })).toBeInTheDocument();
    });

    it('zmiana jezyka w arkuszu mobilnym aktualizuje licznik „pokaż wyniki" (R14)', async () => {
        await renderMapPage('/mapa', NO_FILTERS, CATALOG);
        await userEvent.click(screen.getByRole('button', { name: messages.MapPage.filter }));
        const sheet = screen.getByRole('dialog');
        expect(within(sheet).getByRole('button', { name: 'Pokaż 4 wyniki' })).toBeInTheDocument();

        await pickLanguage(
            within(sheet).getByRole('combobox', { name: messages.MapPage.languageFilter }),
            /^Українська/,
        );

        expect(within(sheet).getByRole('button', { name: 'Pokaż 1 wynik' })).toBeInTheDocument();
    });

    describe('na mobile', () => {
        const originalWidth = window.innerWidth;

        beforeEach(() => {
            Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
        });

        afterEach(() => {
            Object.defineProperty(window, 'innerWidth', {
                value: originalWidth,
                configurable: true,
            });
        });

        it('?lang=be bez wpisow po bialorusku konczy sie empty state, nie pusta mapa (R5)', async () => {
            await renderMapPage('/mapa', NO_FILTERS, CATALOG, { searchParams: '?lang=be' });

            expect(screen.getByRole('status')).toHaveTextContent(messages.EmptyList.description);
            expect(listedNames()).toEqual([]);
        });
    });

    // Regresja (review fazy 3, P2): klucz deduplikacji zapytania semantycznego nie
    // zawieral jezyka. Zmiana `?lang` skracala liste lokalna, efekt czyscil wyniki
    // semantyczne i — przy tym samym kluczu — juz ich nie pobieral.
    describe('wyniki semantyczne po zmianie jezyka', () => {
        const SEMANTIC_RU = service({ name: 'Tlumacz Rosyjski', languages: ['ru'] });
        const SEMANTIC_PL = service({ name: 'Tlumacz Polski', languages: ['pl'] });
        let fetchMock: jest.Mock;

        beforeEach(() => {
            // /api/services to granica systemu — mockujemy tylko ja.
            fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ success: true, services: [SEMANTIC_RU, SEMANTIC_PL] }),
            });
            global.fetch = fetchMock;
            // jsdom 20 nie ma AbortSignal.timeout — bez niego fetch nie startuje wcale,
            // a blad ginie w catch komponentu. Sygnal bez timeoutu wystarczy: fetch jest mockiem.
            if (typeof AbortSignal.timeout !== 'function') {
                AbortSignal.timeout = (): AbortSignal => new AbortController().signal;
            }
        });

        it('pobiera wyniki ponownie z nowym excludeIds i filtruje je jezykiem', async () => {
            // `prawnik` trafia lokalnie tylko w „Prawnik Ukrainski" — za malo, wiec rusza semantyka.
            await renderMapPage('/mapa', NO_FILTERS, CATALOG, { searchParams: '?query=prawnik' });
            await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 3000 });
            expect(await screen.findByText('Tlumacz Polski')).toBeInTheDocument();

            await pickLanguage(languageSelects()[0], /^Русский/);

            await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });
            const [firstUrl] = fetchMock.mock.calls[0];
            const [secondUrl] = fetchMock.mock.calls[1];
            expect(firstUrl).toContain('excludeIds=');
            expect(secondUrl).not.toContain('excludeIds=');
            expect(await screen.findByText('Tlumacz Rosyjski')).toBeInTheDocument();
            expect(screen.queryByText('Tlumacz Polski')).toBeNull();
        });
    });
});
