import { act, fireEvent, render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { NextIntlClientProvider } from 'next-intl';
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing';

import { FilterComponent } from './filter-component';
import messages from '../../../../../messages/pl.json';
import type { MapFilters } from '@/lib/map-slug-parser';

expect.extend(toHaveNoViolations);

// useRouter z next/navigation rzuca bez zamontowanego App Routera. Filtry nie
// nawiguja routerem (pushState), wiec stub tylko musi istniec.
const ROUTER_STUB = {
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
};

const NO_FILTERS: MapFilters = { category: null, county: null, city: null, onlineOnly: false };

const SCROLLER_WIDTH = 688;
const TILE_WIDTH = 109;

/**
 * jsdom nie liczy layoutu — kazdy prostokat ma zera, wiec kafel zawsze wygladalby
 * na widoczny i strażnik „juz w kadrze" konczylby kazdy test przedwczesnie.
 * Podajemy wiec geometrie wprost: kontener stoi w 0..688, a kafel kategorii tam,
 * gdzie ustawi go test.
 */
function mockGeometry(tileLeft: number): void {
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement,
    ): DOMRect {
        const isTile = this.dataset.category !== undefined;
        const left = isTile ? tileLeft : 0;
        const width = isTile ? TILE_WIDTH : SCROLLER_WIDTH;
        return {
            left,
            right: left + width,
            width,
            top: 0,
            bottom: 0,
            height: 0,
            x: left,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect;
    });
}

type RenderOptions = {
    /** Query string widziany przez nuqs, np. `?lang=ru`. */
    searchParams?: string;
    onUrlUpdate?: (event: UrlUpdateEvent) => void;
};

async function renderFilters(
    initialFilters: MapFilters,
    { searchParams = '', onUrlUpdate }: RenderOptions = {},
): Promise<ReturnType<typeof render>> {
    let result: ReturnType<typeof render> | undefined;
    // Modal filtrow idzie przez next/dynamic (React.lazy) — async act czeka, az
    // leniwy modul sie rozwiaze, zanim test zacznie asercje.
    await act(async () => {
        result = render(
            <AppRouterContext.Provider value={ROUTER_STUB}>
                <NextIntlClientProvider locale="pl" messages={messages}>
                    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
                        <FilterComponent initialFilters={initialFilters} totalCount={0} />
                    </NuqsTestingAdapter>
                </NextIntlClientProvider>
            </AppRouterContext.Provider>,
        );
    });
    if (!result) throw new Error('render() nie zwrocil wyniku');
    return result;
}

describe('<FilterComponent /> — pasek kategorii', () => {
    let scrollTo: jest.SpyInstance;

    beforeAll(() => {
        // Modal filtrow wola lockScroll/unlockScroll, a te uzywaja window.scrollTo,
        // ktorego jsdom nie implementuje. Bez tego kazdy cleanup RTL halasuje.
        jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    beforeEach(() => {
        // jsdom nie przewija; stub siedzi w setupAfterEnv, tu tylko go podgladamy.
        scrollTo = jest.spyOn(Element.prototype, 'scrollTo').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Regresja: na 1440px miesci sie 5 z 15 kategorii, a pasek zawsze startowal od
    // lewej. Wejscie z wyszukiwarki na /mapa/inne pokazywalo wyniki bez sladu,
    // ktory filtr je zawezil, bo aktywny kafel stal poza kadrem.
    it('przewija aktywna kategorie do widoku, gdy stoi poza kadrem', async () => {
        mockGeometry(2000);

        await renderFilters({ ...NO_FILTERS, category: 'law' });

        expect(scrollTo).toHaveBeenCalled();
    });

    it('nie rusza paskiem, gdy aktywna kategoria juz jest w kadrze', async () => {
        mockGeometry(100);

        await renderFilters({ ...NO_FILTERS, category: 'law' });

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('bez wybranej kategorii nie rusza paskiem', async () => {
        mockGeometry(2000);

        await renderFilters(NO_FILTERS);

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('aktywna kategoria jest oznaczona dla czytnika ekranu, nie tylko kolorem', async () => {
        await renderFilters({ ...NO_FILTERS, category: 'law' });

        const prawne = screen.getAllByRole('button', { name: /Prawne/ });
        expect(prawne.length).toBeGreaterThan(0);
        prawne.forEach(button => expect(button).toHaveAttribute('aria-pressed', 'true'));
    });
});

// R13: „Usuń filtry" obejmuje jezyk obslugi, ktory zyje w `?lang`, a nie w sciezce.
describe('<FilterComponent /> — jezyk obslugi a „Usuń filtry"', () => {
    beforeAll(() => {
        jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    // Desktopowy kafel ma nazwe z samego tekstu; mobilny przycisk to „Resetuj".
    const removeFilters = (): HTMLElement => screen.getByRole('button', { name: 'Usuń filtry' });

    it('bez zadnego filtra przycisk jest nieaktywny', async () => {
        await renderFilters(NO_FILTERS);

        expect(removeFilters()).toBeDisabled();
    });

    it('sam ?lang=ru wlacza przycisk na desktopie i reset na mobile', async () => {
        await renderFilters(NO_FILTERS, { searchParams: '?lang=ru' });

        expect(removeFilters()).toBeEnabled();
        expect(screen.getByRole('button', { name: /Resetuj/ })).toBeInTheDocument();
    });

    it('klik zdejmuje ?lang z adresu', async () => {
        const onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>();
        await renderFilters(NO_FILTERS, { searchParams: '?lang=ru', onUrlUpdate });

        await act(async () => {
            fireEvent.click(removeFilters());
        });

        expect(onUrlUpdate).toHaveBeenCalled();
        const lastUpdate = onUrlUpdate.mock.calls.at(-1)?.[0];
        expect(lastUpdate?.searchParams.has('lang')).toBe(false);
        expect(removeFilters()).toBeDisabled();
    });

    it('dropdown jezyka stoi w pasku desktop z wybranym jezykiem i bez naruszen a11y', async () => {
        const { container } = await renderFilters(NO_FILTERS, { searchParams: '?lang=uk' });

        const [desktopSelect] = screen.getAllByRole('combobox', { name: 'Język obsługi' });
        expect(desktopSelect).toHaveTextContent('Українська');
        expect(await axe(container)).toHaveNoViolations();
    });
});
