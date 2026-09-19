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

describe('<ServiceCard /> — social media', () => {
    it('renderuje link do X z nazwa dostepna i poprawnym href', () => {
        renderCard({ socials: { x: 'https://x.com/ifiora_Warsaw' } });

        const link = screen.getByRole('link', { name: 'X' });
        expect(link).toHaveAttribute('href', 'https://x.com/ifiora_Warsaw');
    });

    it('nie renderuje sekcji social media, gdy socials jest null', () => {
        renderCard({ socials: null });

        expect(screen.queryByRole('link', { name: 'X' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument();
    });

    // Regresja: bramka `hasSocials` wymieniala tylko facebook/instagram/tiktok,
    // wiec wpis z samym LinkedInem albo samym X-em nie pokazywal ikony wcale.
    it.each([
        ['linkedin', 'LinkedIn', 'https://linkedin.com/company/ifiora'],
        ['x', 'X', 'https://x.com/ifiora_Warsaw'],
    ])('pokazuje %s, gdy jest jedyna siecia wpisu', (key, label, href) => {
        renderCard({ socials: { [key]: href } });

        expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    });

    // Telegram nie nalezy do rzedu ikon — jest kanalem kontaktu, wiec siedzi
    // w przyciskach akcji obok WhatsAppa. Ten sam wybor co dla WhatsAppa,
    // ktorego tez nie ma wsrod ikon.
    it('nie renderuje Telegrama jako ikony social media', () => {
        const { container } = renderCard({ socials: { telegram: 'https://t.me/workupeu' } });

        expect(container.querySelector('a[aria-label="Telegram"]')).not.toBeInTheDocument();
    });
});

describe('<ServiceCard /> — dane kontaktowe', () => {
    it('renderuje adres e-mail jako link mailto', () => {
        renderCard({ email: 'work-up@ukr.net' });

        expect(screen.getByRole('link', { name: 'work-up@ukr.net' })).toHaveAttribute(
            'href',
            'mailto:work-up@ukr.net',
        );
    });

    it('nie renderuje wiersza e-mail, gdy wpis go nie ma', () => {
        const { container } = renderCard({ email: null });

        expect(container.querySelector('a[href^="mailto:"]')).not.toBeInTheDocument();
    });

    it('przechodzi asercje jest-axe z pelnym blokiem kontaktowym', async () => {
        const { container } = renderCard({
            phoneNumber: '+380 67 895 31 05',
            email: 'work-up@ukr.net',
            webpage: 'https://workup.com.ua',
        });

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});

describe('<ServiceCard /> — przyciski akcji', () => {
    it('renderuje przycisk Telegram z linkiem z socials', () => {
        renderCard({ socials: { telegram: 'https://t.me/workupeu' } });

        expect(screen.getByRole('button', { name: 'telegram' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'telegram' })).toHaveAttribute(
            'href',
            'https://t.me/workupeu',
        );
    });

    // Telegram jest czwartym przyciskiem w rzedzie, ktory wczesniej mial najwyzej
    // trzy. Asercja pilnuje, ze zaden z pozostalych nie wypadl przy zmianie siatki.
    it('renderuje wszystkie cztery akcje naraz', () => {
        renderCard({
            phoneNumber: '+48 22 100 20 30',
            whatsappNumber: '+48 501 502 503',
            socials: { telegram: 'https://t.me/workupeu' },
        });

        for (const label of ['call', 'whatsapp', 'telegram', 'navigate']) {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        }
    });

    it('nie renderuje przycisku Telegram, gdy wpis nie ma linku', () => {
        renderCard({ socials: { facebook: 'https://facebook.com/ifiorawarsaw' } });

        expect(screen.queryByRole('button', { name: 'telegram' })).not.toBeInTheDocument();
    });
});

describe('<ServiceCard /> — dostepnosc', () => {
    const warianty: Coverage[] = ['local', 'online', 'hybrid'];

    it('przechodzi asercje jest-axe z wyrenderowanymi socialami', async () => {
        const { container } = renderCard({
            socials: {
                facebook: 'https://facebook.com/ifiorawarsaw',
                instagram: 'https://instagram.com/ifiora_warsaw',
                linkedin: 'https://linkedin.com/company/ifiora',
                x: 'https://x.com/ifiora_Warsaw',
                telegram: 'https://t.me/workupeu',
            },
        });

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

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
