import { shouldRunSemanticSearch } from './semantic-search-trigger';

describe('shouldRunSemanticSearch', () => {
    it('odpala sie, gdy lista lokalna ma mniej niz 3 wyniki', () => {
        expect(shouldRunSemanticSearch({ query: 'prawnik', localResultsCount: 2 })).toBe(true);
    });

    it('nie odpala sie, gdy lista lokalna ma 3 wyniki lub wiecej', () => {
        expect(shouldRunSemanticSearch({ query: 'prawnik', localResultsCount: 3 })).toBe(false);
    });

    it('nie odpala sie dla zapytania krotszego niz 3 znaki po przycieciu', () => {
        expect(shouldRunSemanticSearch({ query: '  ab  ', localResultsCount: 0 })).toBe(false);
    });

    it('nie odpala sie dla pustego zapytania', () => {
        expect(shouldRunSemanticSearch({ query: '', localResultsCount: 0 })).toBe(false);
    });

    describe('przy wybranej kategorii i zapytaniu wielowyrazowym', () => {
        it('odpala sie mimo pelnej listy, gdy ktores slowo ma ponad 4 znaki', () => {
            const isTriggered = shouldRunSemanticSearch({
                query: 'dobry adwokat',
                localResultsCount: 10,
                category: 'law',
            });

            expect(isTriggered).toBe(true);
        });

        it('odpala sie mimo pelnej listy dla slowa ze slownika wskaznikow', () => {
            const isTriggered = shouldRunSemanticSearch({
                query: 'Best bar',
                localResultsCount: 10,
                category: 'gastronomy',
            });

            expect(isTriggered).toBe(true);
        });

        it('nie odpala sie przy pelnej liscie dla krotkich slow spoza slownika', () => {
            const isTriggered = shouldRunSemanticSearch({
                query: 'bar pub',
                localResultsCount: 10,
                category: 'gastronomy',
            });

            expect(isTriggered).toBe(false);
        });
    });

    it('bez kategorii zapytanie wielowyrazowe nie odpala sie przy pelnej liscie', () => {
        const isTriggered = shouldRunSemanticSearch({
            query: 'dobry adwokat',
            localResultsCount: 10,
        });

        expect(isTriggered).toBe(false);
    });
});
