import { categoryEnum } from '@/db/schema';

import { CATEGORY_CONTEXTS, createContextualQuery, isCategory } from './category-contexts';

describe('CATEGORY_CONTEXTS', () => {
    /**
     * Regresja: route i skrypt embeddingow trzymaly wlasne kopie tej mapy i kopia
     * z route'a zgubila `gastronomy`, a dorobila `government`, ktorego nie ma w enumie.
     * Skutkiem byl brak kontekstu dla zapytan o restauracje.
     */
    it('pokrywa kazda wartosc categoryEnum', () => {
        for (const category of categoryEnum.enumValues) {
            expect(CATEGORY_CONTEXTS[category]).toBeDefined();
        }
    });

    it('nie zawiera kluczy spoza categoryEnum', () => {
        expect(Object.keys(CATEGORY_CONTEXTS).sort()).toEqual([...categoryEnum.enumValues].sort());
    });

    it('zaden kontekst nie jest pusty', () => {
        for (const [category, context] of Object.entries(CATEGORY_CONTEXTS)) {
            expect(context.length).toBeGreaterThan(0);
            expect(category).toBeTruthy();
        }
    });
});

describe('isCategory', () => {
    it('rozpoznaje wartosc z enuma', () => {
        expect(isCategory('gastronomy')).toBe(true);
    });

    it('odrzuca wartosc spoza enuma', () => {
        expect(isCategory('government')).toBe(false);
    });

    it('odrzuca null i brak wartosci', () => {
        // `null` przychodzi z `searchParams.get()`, brak klucza — z obiektu parametrow.
        const params: Record<string, string | undefined> = {};

        expect(isCategory(null)).toBe(false);
        expect(isCategory(params.category)).toBe(false);
    });

    /**
     * `in` na zwyklym obiekcie widzi takze klucze z prototypu — bez tego testu
     * `isCategory('toString')` przeszloby i wpuscilo smiec do zapytania.
     */
    it('odrzuca klucze z prototypu obiektu', () => {
        expect(isCategory('toString')).toBe(false);
        expect(isCategory('constructor')).toBe(false);
    });
});

describe('createContextualQuery', () => {
    it('dokleja kontekst kategorii do zapytania', () => {
        const result = createContextualQuery('pierogi', 'gastronomy');

        expect(result).toContain('pierogi');
        expect(result).toContain(CATEGORY_CONTEXTS.gastronomy);
    });

    it('bez kategorii zwraca zapytanie nietkniete', () => {
        expect(createContextualQuery('pierogi', null)).toBe('pierogi');
    });

    it('kategoria spoza enuma zwraca zapytanie nietkniete', () => {
        expect(createContextualQuery('pierogi', 'government')).toBe('pierogi');
    });
});
