import {
    buildSemanticSearchParams,
    MAX_EXCLUDE_IDS,
    SEMANTIC_RECOMMENDATIONS_LIMIT,
} from './semantic-search-request';

describe('buildSemanticSearchParams — excludeIds', () => {
    it('wysyla id firmy raz, choc lista ma wiersz na kazda jej lokalizacje', () => {
        const params = buildSemanticSearchParams({
            query: 'prawnik',
            locale: 'pl',
            excludeIds: ['legallex', 'legallex', 'etalon', 'legallex'],
        });

        expect(params.get('excludeIds')).toBe('legallex,etalon');
    });

    it('nie wysyla wiecej firm, niz przyjmuje endpoint', () => {
        const ids = Array.from({ length: MAX_EXCLUDE_IDS + 10 }, (_, index) => `id-${index}`);

        const params = buildSemanticSearchParams({ query: 'prawnik', locale: 'pl', excludeIds: ids });

        expect(params.get('excludeIds')?.split(',')).toEqual(ids.slice(0, MAX_EXCLUDE_IDS));
    });
});

describe('buildSemanticSearchParams', () => {
    it('przekazuje limit rekomendacji jawnie, zamiast zdawac sie na domyslny', () => {
        const params = buildSemanticSearchParams({
            query: 'prawnik',
            locale: 'pl',
            excludeIds: [],
        });

        expect(params.get('limit')).toBe(String(SEMANTIC_RECOMMENDATIONS_LIMIT));
    });

    it('prosi o wiecej niz domyslne 3 z endpointu', () => {
        expect(SEMANTIC_RECOMMENDATIONS_LIMIT).toBeGreaterThan(3);
    });

    it('wysyla wojewodztwo pod nazwa, ktora czyta endpoint', () => {
        const params = buildSemanticSearchParams({
            query: 'prawnik',
            locale: 'uk',
            category: 'legal',
            voivodeship: 'mazowieckie',
            excludeIds: ['a', 'b'],
        });

        expect(params.get('voivodeship')).toBe('mazowieckie');
        expect(params.get('county')).toBeNull();
        expect(params.get('category')).toBe('legal');
        expect(params.get('locale')).toBe('uk');
        expect(params.get('excludeIds')).toBe('a,b');
    });

    it('pomija puste filtry zamiast wysylac puste parametry', () => {
        const params = buildSemanticSearchParams({
            query: 'prawnik',
            locale: 'pl',
            category: '',
            excludeIds: [],
        });

        expect(params.has('category')).toBe(false);
        expect(params.has('voivodeship')).toBe(false);
        expect(params.has('excludeIds')).toBe(false);
    });
});
