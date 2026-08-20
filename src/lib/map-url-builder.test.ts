import { locales, type Locale } from '@/i18n/config';
import { buildMapUrl, localizeMapPath, stringifyMapUrl } from '@/lib/map-url-builder';

describe('buildMapUrl — slug `online`', () => {
    it('sam onlineOnly daje /map/online', () => {
        expect(buildMapUrl({ onlineOnly: true }, 'pl').pathname).toBe('/map/online');
    });

    it('kategoria + onlineOnly daje /map/{kategoria}/online (pl)', () => {
        expect(buildMapUrl({ category: 'law', onlineOnly: true }, 'pl').pathname).toBe(
            '/map/prawne/online',
        );
    });

    it('kategoria + onlineOnly uzywa sluga kategorii per locale', () => {
        expect(buildMapUrl({ category: 'law', onlineOnly: true }, 'en').pathname).toBe(
            '/map/law/online',
        );
        expect(buildMapUrl({ category: 'law', onlineOnly: true }, 'uk').pathname).toBe(
            '/map/pravovi/online',
        );
    });

    it('onlineOnly zajmuje ten sam slot co wojewodztwo — wygrywa i czysci lokalizacje', () => {
        // Zasieg i lokalizacja to jeden slot w URL, wiec sa wzajemnie wykluczajace.
        // `onlineOnly` ma priorytet: wybor "Online" oznacza rezygnacje z zawezenia geograficznego.
        expect(buildMapUrl({ county: 'pomorskie', onlineOnly: true }, 'pl').pathname).toBe(
            '/map/online',
        );
        expect(buildMapUrl({ city: 'Warszawa', onlineOnly: true }, 'pl').pathname).toBe(
            '/map/online',
        );
    });

    it('onlineOnly false zachowuje sie jak brak flagi', () => {
        expect(buildMapUrl({ onlineOnly: false }, 'pl').pathname).toBe('/map');
        expect(buildMapUrl({ county: 'pomorskie', onlineOnly: false }, 'pl').pathname).toBe(
            '/map/pomorskie',
        );
    });

    it('nie psuje istniejacych tras', () => {
        expect(buildMapUrl({}, 'pl').pathname).toBe('/map');
        expect(buildMapUrl({ category: 'health' }, 'pl').pathname).toBe('/map/zdrowie');
        expect(buildMapUrl({ county: 'pomorskie' }, 'pl').pathname).toBe('/map/pomorskie');
        expect(buildMapUrl({ category: 'law', county: 'pomorskie' }, 'pl').pathname).toBe(
            '/map/prawne/pomorskie',
        );
    });

    it('zachowuje parametry zapytania obok sluga online', () => {
        const url = buildMapUrl({ onlineOnly: true, query: 'ksiegowa', view: 'list' }, 'pl');

        expect(url.pathname).toBe('/map/online');
        expect(url.query).toEqual({ query: 'ksiegowa', view: 'list' });
    });

    it('slug online jest identyczny we wszystkich locale', () => {
        for (const locale of locales) {
            expect(buildMapUrl({ onlineOnly: true }, locale as Locale).pathname).toBe(
                '/map/online',
            );
        }
    });
});

describe('localizeMapPath + stringifyMapUrl dla trasy online', () => {
    it('pl dostaje /mapa/online', () => {
        expect(localizeMapPath('/map/online', 'pl')).toBe('/mapa/online');
    });

    it('pozostale locale zostaja na /map/online', () => {
        expect(localizeMapPath('/map/online', 'en')).toBe('/map/online');
        expect(localizeMapPath('/map/online', 'uk')).toBe('/map/online');
    });

    it('stringifyMapUrl sklada sciezke z parametrami', () => {
        const url = buildMapUrl({ category: 'law', onlineOnly: true, query: 'test' }, 'pl');

        expect(stringifyMapUrl(url)).toBe('/map/prawne/online?query=test');
    });
});
