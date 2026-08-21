import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { MapList } from './map-list';
import type { PartialService, ScrollableListHandle } from '@/types';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna — mock zwraca sam klucz, wiec asercje
// sprawdzaja STRUKTURE sekcji, nie tresc tlumaczen.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

let counter = 0;

function service(overrides: Partial<PartialService> = {}): PartialService {
    counter += 1;
    return {
        id: `id-${counter}`,
        serviceId: `service-${counter}`,
        slug: `slug-${counter}`,
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
        ...overrides,
    };
}

type Overrides = {
    frontendFilteredServices?: PartialService[];
    onlineResults?: PartialService[];
    embeddingResults?: PartialService[];
    isLoadingEmbeddings?: boolean;
};

function renderList(overrides: Overrides = {}) {
    const cardRefs = { current: [] as (HTMLDivElement | null)[] };

    const result = render(
        <MapList
            ref={createRef<ScrollableListHandle>()}
            frontendFilteredServices={overrides.frontendFilteredServices ?? []}
            onlineResults={overrides.onlineResults ?? []}
            embeddingResults={overrides.embeddingResults ?? []}
            isLoadingEmbeddings={overrides.isLoadingEmbeddings ?? false}
            embeddingMeta={null}
            handleFlyTo={jest.fn()}
            resetMap={jest.fn()}
            handleHoverPlace={jest.fn()}
            cardRefs={cardRefs}
            setCardToExpand={jest.fn()}
            cardToExpand={null}
            scrollToTop={jest.fn()}
            setPopup={jest.fn()}
        />,
    );

    return { ...result, cardRefs };
}

describe('<MapList /> — sekcja uslug online', () => {
    beforeEach(() => {
        // useMediaQuery startuje od `false` i przelacza sie dopiero w efekcie, wiec
        // pierwszy render idzie sciezka desktopowa (virtua). Stub matchMedia zapewnia
        // determinizm samego przelaczenia; asercje celuja w DOM, nie w wirtualizacje.
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

    it('renderuje naglowek sekcji i karty, gdy sa wyniki online', () => {
        const lokalna = service({ name: 'Lokalna firma' });
        const zdalna = service({ name: 'Zdalna firma', coverage: 'online' });

        renderList({ frontendFilteredServices: [lokalna], onlineResults: [zdalna] });

        expect(screen.getByText('available_online')).toBeInTheDocument();
        expect(screen.getByText('Zdalna firma')).toBeInTheDocument();
        expect(screen.getByText('Lokalna firma')).toBeInTheDocument();
    });

    it('nie renderuje naglowka sekcji, gdy nie ma wynikow online', () => {
        renderList({ frontendFilteredServices: [service()] });

        expect(screen.queryByText('available_online')).not.toBeInTheDocument();
    });

    it('sekcja online jest widoczna nawet bez wynikow lokalnych', () => {
        const zdalna = service({ name: 'Tylko zdalna', coverage: 'online' });

        renderList({ onlineResults: [zdalna] });

        expect(screen.getByText('available_online')).toBeInTheDocument();
        expect(screen.getByText('Tylko zdalna')).toBeInTheDocument();
    });

    it('trzy sekcje naraz — kazda usluga renderowana dokladnie raz', () => {
        const lokalne = [service(), service()];
        const online = [service({ coverage: 'online' })];
        const embeddingi = [service(), service()];
        const wszystkie = [...lokalne, ...online, ...embeddingi];

        const { cardRefs } = renderList({
            frontendFilteredServices: lokalne,
            onlineResults: online,
            embeddingResults: embeddingi,
        });

        // Kazda usluga dokladnie raz — kolizja licznika cardIndex objawilaby sie
        // brakiem karty albo jej duplikatem.
        for (const usluga of wszystkie) {
            expect(screen.getAllByText(usluga.name)).toHaveLength(1);
        }

        // Zaden indeks nie moze wskazywac na ten sam wezel co inny. NIE sprawdzamy
        // dlugosci tablicy: `virtua` wirtualizuje liste, a w jsdom kontener ma zerowa
        // wysokosc, wiec zbior zamontowanych elementow jest niedeterministyczny.
        const przypisane = cardRefs.current.filter(Boolean);
        expect(new Set(przypisane).size).toBe(przypisane.length);
    });

    it('kolejnosc sekcji: lokalne, potem online, potem semantyczne', () => {
        const lokalna = service({ name: 'AAA lokalna' });
        const zdalna = service({ name: 'BBB zdalna', coverage: 'online' });
        const semantyczna = service({ name: 'CCC semantyczna' });

        renderList({
            frontendFilteredServices: [lokalna],
            onlineResults: [zdalna],
            embeddingResults: [semantyczna],
        });

        const tekst = document.body.textContent ?? '';
        expect(tekst.indexOf('AAA lokalna')).toBeLessThan(tekst.indexOf('available_online'));
        expect(tekst.indexOf('available_online')).toBeLessThan(tekst.indexOf('BBB zdalna'));
        expect(tekst.indexOf('BBB zdalna')).toBeLessThan(tekst.indexOf('CCC semantyczna'));
    });

    it('wszystkie kubelki puste — EmptyState bez naglowkow sekcji', () => {
        renderList();

        expect(screen.queryByText('available_online')).not.toBeInTheDocument();
        expect(screen.queryByText('also_recommended')).not.toBeInTheDocument();
    });

    it('przechodzi asercje dostepnosci przy trzech sekcjach', async () => {
        const { container } = renderList({
            frontendFilteredServices: [service()],
            onlineResults: [service({ coverage: 'online' })],
            embeddingResults: [service()],
        });

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
