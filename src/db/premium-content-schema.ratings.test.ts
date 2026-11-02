import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { PREMIUM_RATINGS_MAX } from '../lib/premium-ratings';
import { premiumContentSchema } from './premium-content-schema';

const GOOGLE = {
    source: 'google',
    rating: 4.8,
    count: 120,
    url: 'https://maps.google.com/?cid=123',
};

function issuePaths(ratings: unknown): string[] {
    const result = premiumContentSchema.safeParse(premiumBlock({ ratings }));
    return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'));
}

describe('premiumContentSchema — oceny z innych serwisow', () => {
    it('przyjmuje oceny znanych serwisow i "other" z nazwa', () => {
        const ratings = [
            GOOGLE,
            { source: 'booksy', rating: 5, count: 0, url: 'https://booksy.com/pl-pl/1_salon' },
            { source: 'fixly', rating: 4.9, count: 42, url: 'https://fixly.pl/profil/jan' },
            { source: 'other', label: 'Oferteo', rating: 0, count: 7, url: 'https://oferteo.pl/x' },
        ];

        const result = premiumContentSchema.safeParse(premiumBlock({ ratings }));

        expect(result.success && result.data.ratings).toEqual(ratings);
    });

    it('brak ocen to pusta lista', () => {
        const result = premiumContentSchema.safeParse(premiumBlock());

        expect(result.success && result.data.ratings).toEqual([]);
    });

    it.each([
        ['ocena ponizej 0', { rating: -0.1 }, 'ratings.0.rating'],
        ['ocena ponad 5', { rating: 5.1 }, 'ratings.0.rating'],
        ['ocena jako tekst', { rating: '4,8' }, 'ratings.0.rating'],
        ['ujemna liczba opinii', { count: -1 }, 'ratings.0.count'],
        ['ulamkowa liczba opinii', { count: 1.5 }, 'ratings.0.count'],
        ['link http', { url: 'http://maps.google.com/?cid=1' }, 'ratings.0.url'],
        ['link javascript:', { url: 'javascript:alert(1)' }, 'ratings.0.url'],
        ['link bez protokolu', { url: 'booksy.com/salon' }, 'ratings.0.url'],
        ['nieznany serwis', { source: 'yelp' }, 'ratings.0.source'],
        ['label przy znanym serwisie', { label: 'Google Maps' }, 'ratings.0.label'],
        ['nieznany klucz', { stars: 5 }, 'ratings.0'],
    ])('odrzuca: %s', (_, override, path) => {
        expect(issuePaths([{ ...GOOGLE, ...override }])).toEqual([path]);
    });

    it('"other" bez nazwy serwisu odrzuca ze sciezka label', () => {
        expect(issuePaths([{ ...GOOGLE, source: 'other' }])).toEqual(['ratings.0.label']);
    });

    it('odrzuca drugi wpis tego samego serwisu; rozne "other" sa dozwolone', () => {
        const otherA = { ...GOOGLE, source: 'other', label: 'Oferteo' };
        const otherB = { ...GOOGLE, source: 'other', label: 'Fixly' };

        expect(issuePaths([GOOGLE, { ...GOOGLE, count: 3 }])).toEqual(['ratings.1.source']);
        expect(issuePaths([otherA, otherB])).toEqual([]);
        expect(issuePaths([otherA, { ...otherA, count: 1 }])).toEqual(['ratings.1.source']);
    });

    it(`odrzuca wiecej niz ${PREMIUM_RATINGS_MAX} serwisow`, () => {
        const ratings = Array.from({ length: PREMIUM_RATINGS_MAX + 1 }, (_, index) => ({
            ...GOOGLE,
            source: 'other',
            label: `Serwis ${index}`,
        }));

        expect(issuePaths(ratings)).toEqual(['ratings']);
    });
});
