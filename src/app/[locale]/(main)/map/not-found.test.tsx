import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import MapNotFound from './not-found';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna. Mock zwraca sam klucz, wiec asercje
// sprawdzaja strukture strony, nie tresc tlumaczen.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

// Link z @/i18n/navigation ciagnie routing next-intl (ESM w tescie).
jest.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

describe('<MapNotFound />', () => {
    it('renderuje naglowek, opis i oba odnosniki', () => {
        render(<MapNotFound />);

        expect(screen.getByText('mapHeading')).toBeInTheDocument();
        expect(screen.getByText('mapDescription')).toBeInTheDocument();
        expect(screen.getByText('backToMap')).toBeInTheDocument();
        expect(screen.getByText('backHome')).toBeInTheDocument();
    });

    it('odnosniki prowadza do wewnetrznych sciezek, ktore zlokalizuje next-intl', () => {
        render(<MapNotFound />);

        const hrefs = [...document.querySelectorAll('a')].map(a => a.getAttribute('href'));

        // `/map`, nie `/mapa` — lokalizacja sciezki jest zadaniem @/i18n/navigation
        expect(hrefs).toContain('/map');
        expect(hrefs).toContain('/');
    });

    it('nie zawiera reliktow po forku abroad-services', () => {
        render(<MapNotFound />);

        const tekst = document.body.textContent ?? '';
        expect(tekst).not.toMatch(/Qolie/i);
        expect(tekst).not.toMatch(/Ireland/i);
        expect(tekst).not.toMatch(/Irlandi/i);
    });

    it('stopka nosi nazwe Polvia', () => {
        render(<MapNotFound />);

        expect(document.body.textContent).toContain('Polvia');
    });

    it('nie ma zahardkodowanego angielskiego tekstu poza numerem bledu', () => {
        render(<MapNotFound />);

        // Kazdy tekst widoczny dla uzytkownika idzie przez i18n, wiec przy mocku
        // zwracajacym klucze w DOM nie moze byc zdania po angielsku.
        const tekst = document.body.textContent ?? '';
        expect(tekst).not.toMatch(/Page Not Found|Back to Homepage|get you back on track/i);
    });

    it('przechodzi asercje dostepnosci', async () => {
        const { container } = render(<MapNotFound />);

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
