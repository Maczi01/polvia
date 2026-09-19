import { act, render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Cookies from 'js-cookie';

import { CookieConsentBanner } from './cookie-consent-banner';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna — mock zwraca sam klucz.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

/** Baner pokazuje sie po 3 s, a klase animacji dostaje 100 ms pozniej. */
const REVEAL_MS = 3100;

function revealBanner(): void {
    act(() => {
        jest.advanceTimersByTime(REVEAL_MS);
    });
}

function banner(container: HTMLElement): HTMLElement {
    const element = container.querySelector<HTMLElement>('div.fixed');
    if (!element) throw new Error('Baner cookie nie zostal wyrenderowany');
    return element;
}

beforeEach(() => {
    jest.useFakeTimers();
    Cookies.remove('cookieConsent');
});

afterEach(() => {
    jest.useRealTimers();
});

describe('<CookieConsentBanner />', () => {
    // Regresja: klasa warunkowa byla doklejana do bazowej bez spacji, przez co
    // `md:w-auto` i `translate-y-0` zlewaly sie w jeden nieistniejacy token.
    // Baner zostawal `w-full` mimo `md:right-5`, wiec na desktopie wystawal
    // poza lewa krawedz ekranu i ucinal tekst.
    it('trzyma klasy warunkowe jako osobne tokeny', () => {
        const { container } = render(<CookieConsentBanner />);
        revealBanner();

        const tokens = [...banner(container).classList];

        // Klasa ze stanu animacji musi byc wlasnym tokenem, nie ogonem poprzedniej.
        expect(tokens).toContain('translate-y-0');

        // Generyczny straznik sklejki: 'translate' moze wystapic tylko na poczatku
        // klasy. W zepsutej wersji siedzialo w srodku 'md:w-autotranslate-y-0'.
        const glued = tokens.filter(
            token => token.includes('translate') && !token.startsWith('translate-'),
        );
        expect(glued).toEqual([]);

        // Na desktopie baner jest kartą o ograniczonej szerokości, nie pasem
        // przez caly ekran — to ograniczenie bylo gubione razem ze sklejka.
        expect(tokens).toContain('md:max-w-md');
    });

    it('nie pokazuje sie, gdy decyzja jest juz zapisana', () => {
        Cookies.set('cookieConsent', 'accepted');

        const { container } = render(<CookieConsentBanner />);
        revealBanner();

        expect(container.querySelector('div.fixed')).toBeNull();
    });

    it.each([
        ['acceptAll', 'accepted'],
        ['decline', 'declined'],
    ])('zapisuje decyzje %s i chowa baner', (label, expected) => {
        const { container } = render(<CookieConsentBanner />);
        revealBanner();

        act(() => {
            screen.getByRole('button', { name: label }).click();
        });

        expect(Cookies.get('cookieConsent')).toBe(expected);
        expect(container.querySelector('div.fixed')).toBeNull();
    });

    it('sprzata oba timery przy odmontowaniu przed pokazaniem banera', () => {
        const { unmount } = render(<CookieConsentBanner />);

        unmount();
        // Bez cleanupu wewnetrznego timera to wywolanie konczy sie `setState`
        // na odmontowanym komponencie.
        expect(() => revealBanner()).not.toThrow();
    });

    it('przechodzi asercje jest-axe', async () => {
        const { container } = render(<CookieConsentBanner />);
        revealBanner();

        // axe opiera sie na wlasnych timerach — pod `useFakeTimers` nigdy nie konczy.
        jest.useRealTimers();

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
