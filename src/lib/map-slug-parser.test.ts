import { locales, type Locale } from '@/i18n/config';
import { buildMapUrl } from '@/lib/map-url-builder';
import { parseMapSlug } from '@/lib/map-slug-parser';
import {
    CATEGORY_SLUGS,
    CITY_SLUGS,
    COUNTY_SLUGS,
    COVERAGE_ONLINE_SLUG,
    isOnlineSlug,
} from '@/lib/slug-mappings';

/** Zamienia pathname z buildMapUrl ('/map/prawne/online') na tablice segmentow. */
const toSegments = (pathname: string): string[] =>
    pathname.split('/').filter(Boolean).slice(1);

describe('parseMapSlug — slug `online` w slocie lokalizacji', () => {
    it('brak sluga daje onlineOnly false', () => {
        const result = parseMapSlug(undefined, 'pl');

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.filters).toEqual({
            category: null,
            county: null,
            city: null,
            onlineOnly: false,
        });
    });

    it('pojedynczy segment `online` wlacza onlineOnly bez kategorii i lokalizacji', () => {
        const result = parseMapSlug(['online'], 'pl');

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.filters).toEqual({
            category: null,
            county: null,
            city: null,
            onlineOnly: true,
        });
    });

    it('kategoria + `online` laczy obie osie (pl)', () => {
        const result = parseMapSlug(['prawne', 'online'], 'pl');

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.filters.category).toBe('law');
        expect(result.filters.onlineOnly).toBe(true);
        expect(result.filters.county).toBeNull();
        expect(result.filters.city).toBeNull();
    });

    it('kategoria + `online` dziala tez w en', () => {
        const result = parseMapSlug(['law', 'online'], 'en');

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.filters.category).toBe('law');
        expect(result.filters.onlineOnly).toBe(true);
    });

    it('slug `online` jest ten sam we wszystkich locale', () => {
        for (const locale of locales) {
            const result = parseMapSlug([COVERAGE_ONLINE_SLUG], locale as Locale);
            expect(result.success).toBe(true);
            if (!result.success) continue;
            expect(result.filters.onlineOnly).toBe(true);
        }
    });

    it('wojewodztwo + `online` jest odrzucane — pierwszy segment musi byc kategoria', () => {
        const result = parseMapSlug(['pomorskie', 'online'], 'pl', '/mapa');

        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.redirectTo).toBe('/mapa');
    });

    it('`online` + wojewodztwo jest odrzucane — sprzeczna kombinacja', () => {
        const result = parseMapSlug(['online', 'pomorskie'], 'pl', '/mapa');

        expect(result.success).toBe(false);
    });

    it('trzy segmenty sa odrzucane', () => {
        const result = parseMapSlug(['online', 'prawne', 'pomorskie'], 'pl', '/mapa');

        expect(result.success).toBe(false);
    });

    it('istniejace trasy nadal dzialaja — kategoria sama', () => {
        const result = parseMapSlug(['prawne'], 'pl');

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.filters.category).toBe('law');
        expect(result.filters.onlineOnly).toBe(false);
    });

    it('istniejace trasy nadal dzialaja — wojewodztwo samo', () => {
        const result = parseMapSlug(['pomorskie'], 'pl');

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.filters.county).toBe('pomorskie');
        expect(result.filters.onlineOnly).toBe(false);
    });

    it('istniejace trasy nadal dzialaja — kategoria + wojewodztwo', () => {
        const result = parseMapSlug(['prawne', 'pomorskie'], 'pl');

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.filters.category).toBe('law');
        expect(result.filters.county).toBe('pomorskie');
        expect(result.filters.onlineOnly).toBe(false);
    });
});

describe('isOnlineSlug — brak kolizji z istniejacymi slugami', () => {
    it('rozpoznaje `online` niezaleznie od wielkosci liter', () => {
        expect(isOnlineSlug('online')).toBe(true);
        expect(isOnlineSlug('ONLINE')).toBe(true);
        expect(isOnlineSlug(' Online ')).toBe(true);
    });

    it('nie koliduje z zadnym slugiem kategorii w zadnym locale', () => {
        for (const locale of locales) {
            for (const slug of Object.values(CATEGORY_SLUGS[locale as Locale])) {
                expect(isOnlineSlug(slug)).toBe(false);
            }
        }
    });

    it('nie koliduje z zadnym slugiem wojewodztwa', () => {
        for (const slug of COUNTY_SLUGS) {
            expect(isOnlineSlug(slug)).toBe(false);
        }
    });

    it('nie koliduje z zadnym slugiem miasta', () => {
        for (const slug of CITY_SLUGS) {
            expect(isOnlineSlug(slug)).toBe(false);
        }
    });
});

describe('round-trip buildMapUrl -> parseMapSlug', () => {
    const cases = [
        { label: 'tylko online', params: { onlineOnly: true } },
        { label: 'kategoria + online', params: { category: 'law', onlineOnly: true } },
        { label: 'tylko kategoria', params: { category: 'health' } },
        { label: 'kategoria + wojewodztwo', params: { category: 'law', county: 'pomorskie' } },
    ];

    for (const { label, params } of cases) {
        it(`zachowuje filtry dla kazdego locale: ${label}`, () => {
            for (const locale of locales) {
                const url = buildMapUrl(params, locale as Locale);
                const result = parseMapSlug(toSegments(url.pathname), locale as Locale);

                expect(result.success).toBe(true);
                if (!result.success) continue;
                expect(result.filters.category).toBe(params.category ?? null);
                expect(result.filters.county).toBe(params.county ?? null);
                expect(result.filters.onlineOnly).toBe(params.onlineOnly ?? false);
            }
        });
    }
});
