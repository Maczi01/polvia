import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ServiceCard } from './service-card';
import type { Coverage, PartialService } from '@/types';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna — mock zwraca sam klucz, wiec asercje
// sprawdzaja strukture karty, nie tresc tlumaczen.
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
        coverage: 'local' as Coverage,
        tags: null,
        city: 'Warszawa',
        street: 'ul. Testowa 1',
        voivodeship: 'mazowieckie',
        postcode: null,
        latitude: 52.2297,
        longitude: 21.0122,
        openingHours: {
            monday: { open: '09:00', close: '17:00' },
            tuesday: { open: '09:00', close: '17:00' },
            wednesday: { open: '09:00', close: '17:00' },
            thursday: { open: '09:00', close: '17:00' },
            friday: { open: '09:00', close: '17:00' },
            saturday: { open: '09:00', close: '17:00' },
            sunday: { open: '09:00', close: '17:00' },
        },
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

const handleFlyTo = jest.fn();

// Karta zglasza klik do /api/increase-popularity-counter, a jsdom nie ma fetch.
// To wywolanie zewnetrznego serwisu — mock jest tu uzasadniony.
beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never;
});

function renderCard(overrides: Partial<PartialService> = {}) {
    handleFlyTo.mockClear();
    const data = service(overrides);

    const result = render(
        <ServiceCard
            {...data}
            index={0}
            handleFlyTo={handleFlyTo}
            resetMap={jest.fn()}
            setCardToExpand={jest.fn()}
            cardToExpand={null}
            handleHoverPlace={jest.fn()}
            setPopup={jest.fn()}
        />,
    );

    return { ...result, data };
}

const navigateLink = () =>
    document.querySelector('a[href*="google.com/maps/dir"]') as HTMLAnchorElement | null;

describe('<ServiceCard /> — zachowanie bazowe (characterization)', () => {
    it('wpis lokalny renderuje nazwe, miasto i wojewodztwo', () => {
        const { data } = renderCard();

        expect(screen.getByText(data.name)).toBeInTheDocument();
        expect(screen.getAllByText(/Warszawa/).length).toBeGreaterThan(0);
    });

    it('wpis lokalny ma link nawigacji z poprawnymi wspolrzednymi', () => {
        renderCard({ latitude: 52.2297, longitude: 21.0122 });

        expect(navigateLink()).not.toBeNull();
        expect(navigateLink()?.href).toContain('destination=52.2297,21.0122');
    });

    it('wpis lokalny NIE ma oznaczenia zasiegu', () => {
        renderCard({ coverage: 'local' });

        expect(screen.queryByText('coverage_online')).not.toBeInTheDocument();
    });
});

describe('<ServiceCard /> — zasieg obslugi', () => {
    it('wpis online ma oznaczenie zasiegu', () => {
        renderCard({ coverage: 'online' });

        expect(screen.getByText('coverage_online')).toBeInTheDocument();
    });

    it('wpis hybrid ma oznaczenie zasiegu', () => {
        renderCard({ coverage: 'hybrid' });

        expect(screen.getByText('coverage_online')).toBeInTheDocument();
    });

    it('wpis hybrid ma oznaczenie ORAZ link nawigacji', () => {
        renderCard({ coverage: 'hybrid' });

        expect(screen.getByText('coverage_online')).toBeInTheDocument();
        expect(navigateLink()).not.toBeNull();
    });
});

describe('<ServiceCard /> — wpis bez wspolrzednych', () => {
    it('NIE renderuje linku nawigacji', () => {
        renderCard({ coverage: 'online', latitude: null, longitude: null });

        expect(navigateLink()).toBeNull();
    });

    it('nie generuje adresu z "null" w tresci', () => {
        renderCard({ coverage: 'online', latitude: null, longitude: null });

        expect(document.body.textContent).not.toContain('null');
    });

    it('adres bez ulicy nie ma wiszacego przecinka', () => {
        renderCard({
            coverage: 'online',
            street: null,
            latitude: null,
            longitude: null,
            city: 'Warszawa',
        });

        const tekst = document.body.textContent ?? '';
        expect(tekst).not.toMatch(/,\s*,/);
        expect(tekst).not.toMatch(/^\s*,/m);
    });

    it('puste openingHours nie rzucaja wyjatku', () => {
        // Wpis o zasiegu `online` zapisuje `openingHours: {}` — godziny otwarcia nie
        // maja sensu przy obsludze zdalnej. Karta musi to zniesc bez bledu.
        expect(() =>
            renderCard({ coverage: 'online', openingHours: {}, latitude: null, longitude: null }),
        ).not.toThrow();
    });

    it('klik karty nie wola handleFlyTo, gdy brak wspolrzednych', async () => {
        const { data } = renderCard({ coverage: 'online', latitude: null, longitude: null });

        screen.getByText(data.name).click();

        expect(handleFlyTo).not.toHaveBeenCalled();
    });
});

describe('<ServiceCard /> — dostepnosc', () => {
    const warianty: Coverage[] = ['local', 'online', 'hybrid'];

    for (const coverage of warianty) {
        it(`przechodzi asercje jest-axe dla zasiegu ${coverage}`, async () => {
            const wspolrzedne =
                coverage === 'online' ? { latitude: null, longitude: null } : {};
            const { container } = renderCard({ coverage, ...wspolrzedne });

            const results = await axe(container);
            expect(results).toHaveNoViolations();
        });
    }
});
