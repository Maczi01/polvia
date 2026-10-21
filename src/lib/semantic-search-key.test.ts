import { semanticSearchKey } from './semantic-search-key';
import type { CoverageFilters } from './service-coverage';

const BASE: CoverageFilters = {
    query: 'prawnik',
    category: 'law',
    county: 'pomorskie',
    city: null,
    onlineOnly: false,
    language: null,
};

describe('semanticSearchKey', () => {
    it('te same filtry daja ten sam klucz', () => {
        expect(semanticSearchKey({ ...BASE })).toBe(semanticSearchKey({ ...BASE }));
    });

    it.each<[string, CoverageFilters]>([
        ['jezyk', { ...BASE, language: 'ru' }],
        ['miasto', { ...BASE, city: 'gdansk' }],
        ['zasieg online', { ...BASE, onlineOnly: true }],
        ['fraza', { ...BASE, query: 'notariusz' }],
        ['kategoria', { ...BASE, category: 'health' }],
        ['wojewodztwo', { ...BASE, county: 'mazowieckie' }],
    ])('zmiana osi „%s" zmienia klucz', (_axis, changed) => {
        expect(semanticSearchKey(changed)).not.toBe(semanticSearchKey(BASE));
    });

    it('brak wartosci i pusta wartosc to ten sam stan filtra', () => {
        expect(semanticSearchKey({ query: 'prawnik' })).toBe(
            semanticSearchKey({ query: 'prawnik', category: '', county: null, onlineOnly: false }),
        );
    });

    it('wartosci nie sklejaja sie miedzy osiami', () => {
        expect(semanticSearchKey({ query: 'a-b', category: 'c' })).not.toBe(
            semanticSearchKey({ query: 'a', category: 'b-c' }),
        );
    });
});
