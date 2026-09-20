import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ServiceGroupCard } from './service-group-card';
import type { PartialService } from '@/types';

expect.extend(toHaveNoViolations);

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, unknown>) =>
        values ? `${key}:${JSON.stringify(values)}` : key,
}));

function member(city: string, index: number): PartialService {
    return {
        id: `best-market-${index}`,
        serviceId: 'best-market',
        name: 'Best Market',
        city,
        category: 'grocery',
        languages: ['pl', 'uk'],
        tags: ['Produkty'],
        description: 'Sieć sklepów z produktami ukraińskimi.',
    } as unknown as PartialService;
}

const MEMBERS = [member('Warszawa', 0), member('Kraków', 1), member('Warszawa', 2)];

function renderCard(overrides: Partial<Parameters<typeof ServiceGroupCard>[0]> = {}) {
    const onToggle = jest.fn();

    const result = render(
        <ServiceGroupCard
            name="Best Market"
            services={MEMBERS}
            cities={['Warszawa', 'Kraków']}
            isExpanded={false}
            onToggle={onToggle}
            onHover={jest.fn()}
            {...overrides}
        />,
    );

    return { ...result, onToggle };
}

describe('<ServiceGroupCard />', () => {
    it('pokazuje nazwe firmy', () => {
        renderCard();

        expect(screen.getByText('Best Market')).toBeInTheDocument();
    });

    /**
     * Licznik dostaje liczby z PRZEKAZANYCH lokalizacji, nie z calej firmy.
     * Lista jest filtrowana przed zgrupowaniem, wiec po zawezeniu do Krakowa
     * karta ma mowic o krakowskich punktach — inaczej klamie o tym, co
     * uzytkownik zobaczy po rozwinieciu.
     */
    it('liczy punkty i miasta z przekazanych lokalizacji', () => {
        renderCard();

        expect(screen.getByText(/"locations":3/)).toBeInTheDocument();
        expect(screen.getByText(/"cities":2/)).toBeInTheDocument();
    });

    it('zglasza zwiniecie i rozwiniecie przez onToggle', async () => {
        const { onToggle } = renderCard();

        await userEvent.click(screen.getByRole('button'));

        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('komunikuje stan rozwiniecia czytnikom ekranu', () => {
        const { rerender } = renderCard();

        expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');

        rerender(
            <ServiceGroupCard
                name="Best Market"
                services={MEMBERS}
                cities={['Warszawa', 'Kraków']}
                isExpanded
                onToggle={jest.fn()}
                onHover={jest.fn()}
            />,
        );

        expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    });

    // Hover na zwinietej grupie ma podswietlic KOMPLET pinow firmy, nie jeden.
    it('oddaje wszystkie id lokalizacji przy najechaniu', async () => {
        const onHover = jest.fn();
        renderCard({ onHover });

        await userEvent.hover(screen.getByRole('button'));

        expect(onHover).toHaveBeenCalledWith(MEMBERS.map(m => m.id));
    });

    it('czysci podswietlenie przy zjechaniu kursorem', async () => {
        const onHover = jest.fn();
        renderCard({ onHover });

        const button = screen.getByRole('button');
        await userEvent.hover(button);
        await userEvent.unhover(button);

        expect(onHover).toHaveBeenLastCalledWith(null);
    });

    /**
     * Zwinieta grupa stoi w liscie obok zwyklych kart, ktore pokazuja logo firmy.
     * Ikona zastepcza wyrozniala ja wizualnie bez powodu — logo jest na poziomie
     * firmy, wiec wystarczy wziac je z dowolnej lokalizacji grupy.
     */
    // Zapytanie po elemencie, nie po roli: logo ma `alt=""`, bo nazwa firmy stoi
    // tuz obok i czytnik ekranu nie powinien czytac jej dwa razy. Obrazek jest
    // wiec swiadomie dekoracyjny i roli `img` nie ma.
    it('pokazuje logo firmy, gdy wpis je ma', () => {
        const { container } = renderCard({
            services: MEMBERS.map(m => ({ ...m, image: 'best-market.png' }) as PartialService),
        });

        expect(container.querySelector('img')).toHaveAttribute(
            'src',
            expect.stringContaining('best-market.png'),
        );
    });

    it('spada na obrazek domyslny, gdy firma nie ma logo', () => {
        const { container } = renderCard();

        expect(container.querySelector('img')).toHaveAttribute(
            'src',
            expect.stringContaining('default.png'),
        );
    });

    /**
     * Firma z wieloma punktami dostawala SLABSZA karte niz jednopunktowa: mniejsze
     * logo i zero tagow. Zasieg to atut, wiec karta grupy ma byc co najmniej tak
     * mocna jak zwykla — te same 56 px logo i ta sama liczba tagow.
     */
    it('pokazuje tagi firmy', () => {
        renderCard({
            services: MEMBERS.map(
                m => ({ ...m, tags: ['Produkty', 'Wedliny', 'Slodycze'] }) as PartialService,
            ),
        });

        expect(screen.getByText('Produkty')).toBeInTheDocument();
        expect(screen.getByText('Wedliny')).toBeInTheDocument();
    });

    it('ogranicza tagi do trzech, tak jak zwykla karta', () => {
        renderCard({
            services: MEMBERS.map(
                m => ({ ...m, tags: ['A', 'B', 'C', 'D', 'E'] }) as PartialService,
            ),
        });

        expect(screen.queryByText('D')).not.toBeInTheDocument();
    });

    it('ma logo tej samej wielkosci co zwykla karta', () => {
        const { container } = renderCard();

        expect(container.querySelector('img')).toHaveAttribute('width', '56');
    });

    it('oznacza firme jako wielolokalizacyjna', () => {
        renderCard();

        expect(screen.getByText('multi_location')).toBeInTheDocument();
    });

    it('przechodzi asercje jest-axe', async () => {
        const { container } = renderCard();

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
