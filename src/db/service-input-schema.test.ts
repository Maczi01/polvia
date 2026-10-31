import { isValidServiceSlug } from '../lib/service-slug-format';
import {
    buildLocationSlugs,
    buildServiceSlug,
    serviceInputSchema,
} from './service-input-schema';

/**
 * Minimalny poprawny wpis. Testy nadpisuja tylko to pole, ktore badaja —
 * dzieki temu kazdy blad ma jedna, jawna przyczyne.
 */
function validInput(overrides: Record<string, unknown> = {}) {
    return {
        name: 'Kwiaciarnia Roza',
        category: 'others',
        translations: {
            pl: { description: 'Kwiaciarnia w Warszawie.' },
            uk: { description: 'Квіткарня у Варшаві.' },
            en: { description: 'Florist in Warsaw.' },
            ru: { description: 'Цветочный магазин в Варшаве.' },
        },
        locations: [
            {
                city: 'Warszawa',
                latitude: 52.23,
                longitude: 21.01,
            },
        ],
        ...overrides,
    };
}

describe('serviceInputSchema', () => {
    it('przyjmuje minimalny wpis i uzupelnia domyslne wartosci', () => {
        const result = serviceInputSchema.safeParse(validInput());

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.data.slug).toBe('kwiaciarnia-roza');
        expect(result.data.coverage).toBe('local');
        expect(result.data.status).toBe('active');
        expect(result.data.verified).toBe(false);
        expect(result.data.languages).toEqual(['pl']);
        expect(result.data.tags).toEqual([]);
        expect(result.data.locations[0].openingHours).toEqual({});
    });

    it('ustawia pierwsza lokalizacje jako glowna, gdy zadna nie jest wskazana', () => {
        const result = serviceInputSchema.safeParse(
            validInput({
                locations: [
                    { city: 'Warszawa', latitude: 52.23, longitude: 21.01 },
                    { city: 'Krakow', latitude: 50.06, longitude: 19.94 },
                ],
            }),
        );

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.data.locations.map(location => location.isMainLocation)).toEqual([
            true,
            false,
        ]);
    });

    it('odrzuca wpis, w ktorym dwie lokalizacje sa oznaczone jako glowne', () => {
        const result = serviceInputSchema.safeParse(
            validInput({
                locations: [
                    { city: 'Warszawa', latitude: 52.23, longitude: 21.01, isMainLocation: true },
                    { city: 'Krakow', latitude: 50.06, longitude: 19.94, isMainLocation: true },
                ],
            }),
        );

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues[0].message).toContain('isMainLocation');
    });

    it('wymaga wspolrzednych dla zasiegu local', () => {
        const result = serviceInputSchema.safeParse(
            validInput({ locations: [{ city: 'Warszawa' }] }),
        );

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues.map(issue => issue.path.join('.'))).toEqual([
            'locations.0.latitude',
            'locations.0.longitude',
        ]);
    });

    it('dopuszcza brak wspolrzednych dla zasiegu online', () => {
        const result = serviceInputSchema.safeParse(
            validInput({ coverage: 'online', locations: [{ city: 'Bialystok' }] }),
        );

        expect(result.success).toBe(true);
    });

    it('odrzuca zasieg online z wieloma lokalizacjami', () => {
        const result = serviceInputSchema.safeParse(
            validInput({
                coverage: 'online',
                locations: [{ city: 'Bialystok' }, { city: 'Warszawa' }],
            }),
        );

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues[0].message).toContain('hybrid');
    });

    it('odrzuca literowke w nazwie pola zamiast cicho ja pomijac', () => {
        const result = serviceInputSchema.safeParse(
            validInput({ locations: [{ city: 'Warszawa', lat: 52.23, longitude: 21.01 }] }),
        );

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues.some(issue => issue.code === 'unrecognized_keys')).toBe(true);
    });

    it('wymaga opisu we wszystkich czterech jezykach', () => {
        const result = serviceInputSchema.safeParse(
            validInput({
                translations: {
                    pl: { description: 'Kwiaciarnia w Warszawie.' },
                    uk: { description: 'Квіткарня у Варшаві.' },
                    en: { description: 'Florist in Warsaw.' },
                },
            }),
        );

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues[0].path.join('.')).toBe('translations.ru');
    });

    it('odrzuca nieznany dzien tygodnia w godzinach otwarcia', () => {
        const result = serviceInputSchema.safeParse(
            validInput({
                locations: [
                    {
                        city: 'Warszawa',
                        latitude: 52.23,
                        longitude: 21.01,
                        openingHours: { monady: { open: '10:00', close: '17:00' } },
                    },
                ],
            }),
        );

        expect(result.success).toBe(false);
    });

    it('odrzuca godzine spoza formatu HH:MM', () => {
        const result = serviceInputSchema.safeParse(
            validInput({
                locations: [
                    {
                        city: 'Warszawa',
                        latitude: 52.23,
                        longitude: 21.01,
                        openingHours: { monday: { open: '25:00', close: '17:00' } },
                    },
                ],
            }),
        );

        expect(result.success).toBe(false);
    });

    it('odrzuca kategorie spoza enuma', () => {
        const result = serviceInputSchema.safeParse(validInput({ category: 'online' }));

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues[0].path.join('.')).toBe('category');
    });

    it('przyjmuje jawna baze slugow lokalizacji zamiast wyliczonej z nazwy', () => {
        const result = serviceInputSchema.safeParse(validInput({ slug: 'roza-warszawa' }));

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.data.slug).toBe('roza-warszawa');
    });

    it.each(['abc-', '-abc', 'a--b', 'Roza', 'a_b'])(
        'odrzuca slug %s, ktorego middleware nie przepusci',
        slug => {
            const result = serviceInputSchema.safeParse(validInput({ slug }));

            expect(result.success).toBe(false);
            if (result.success) return;

            expect(result.error.issues[0].path.join('.')).toBe('slug');
        },
    );

    it('odrzuca nazwe, z ktorej nie da sie wyliczyc slugu, gdy brak jawnego slugu', () => {
        const result = serviceInputSchema.safeParse(validInput({ name: '!!!' }));

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error.issues[0].path.join('.')).toBe('slug');
    });
});

describe('buildServiceSlug', () => {
    it.each([
        'Kancelaria Nowak & Wspolnicy',
        'Żłobek Słoneczko',
        'Привет мир',
        'Привіт Їжак',
        '- Myslniki na brzegach -',
        'a -- b',
        'Café—Bar',
        'Studio 2',
        '😀 Cafe',
        'ß straße',
    ])('wynik dla %s ma format slugu uslugi', name => {
        expect(isValidServiceSlug(buildServiceSlug(name))).toBe(true);
    });

    it.each(['!!!', '--', '中文', 'Ⅻ'])(
        'nazwa %s bez znakow [a-z0-9] daje pusty slug (zastepczy przydziela allocator)',
        name => {
            expect(buildServiceSlug(name)).toBe('');
        },
    );

    it('sprowadza polskie znaki i spacje do postaci URL-owej', () => {
        expect(buildServiceSlug('Żłobek Słoneczko')).toBe('zlobek-sloneczko');
    });
});

describe('buildLocationSlugs', () => {
    it('nie numeruje slugow, gdy w kazdym miescie jest jeden punkt', () => {
        expect(buildLocationSlugs('best-market', ['Warszawa', 'Kraków'])).toEqual([
            'best-market-warszawa',
            'best-market-krakow',
        ]);
    });

    it('numeruje slugi punktow w tym samym miescie', () => {
        expect(buildLocationSlugs('best-market', ['Warszawa', 'Kraków', 'Warszawa'])).toEqual([
            'best-market-warszawa-1',
            'best-market-krakow',
            'best-market-warszawa-2',
        ]);
    });
});
