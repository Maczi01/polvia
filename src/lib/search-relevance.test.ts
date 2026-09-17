import { calculateRelevanceBoost, RELEVANCE_FLOOR, selectRelevant, type ScoredCandidate } from './search-relevance';

function candidate(overrides: Partial<ScoredCandidate> = {}): ScoredCandidate {
    return { name: 'Przykladowa Firma', category: 'law', relevanceScore: 0.5, ...overrides };
}

describe('RELEVANCE_FLOOR', () => {
    /**
     * Zapora pomiarowa, nie kosmetyka. 0.357 to najnizszy zmierzony top1 dla zapytania
     * trafnego ("fryzjer") na zywej bazie; prog powyzej tej wartosci zaczyna wycinac
     * poprawne wyniki. Poprzednia wartosc 0.8 byla nieosiagalna i endpoint zwracal
     * pustke na kazde zapytanie.
     */
    it('nie przekracza najnizszego zmierzonego trafienia dla poprawnego zapytania', () => {
        expect(RELEVANCE_FLOOR).toBeLessThanOrEqual(0.357);
    });

    it('nie jest zerem — inaczej zapytania spoza domeny zwracalyby przypadkowe wpisy', () => {
        expect(RELEVANCE_FLOOR).toBeGreaterThan(0);
    });
});

describe('calculateRelevanceBoost', () => {
    it('zwraca 1 dla wyniku, ktory nie trafia ani w kategorie, ani w nazwe', () => {
        const boost = calculateRelevanceBoost(candidate({ name: 'Warsztat Kowalski' }), 'fryzjer', null);

        expect(boost).toBe(1);
    });

    it('premiuje zgodnosc kategorii', () => {
        const boost = calculateRelevanceBoost(candidate({ category: 'beauty', name: 'Salon' }), 'fryzjer', 'beauty');

        expect(boost).toBeCloseTo(1.3);
    });

    it('premiuje trafienie wszystkich slow zapytania w nazwie', () => {
        const boost = calculateRelevanceBoost(candidate({ name: 'Salon Fryzjerski Anna' }), 'salon anna', null);

        expect(boost).toBeCloseTo(1.2);
    });

    it('premiuje czesciowe trafienie proporcjonalnie', () => {
        const boost = calculateRelevanceBoost(candidate({ name: 'Salon Fryzjerski' }), 'salon anna', null);

        expect(boost).toBeCloseTo(1.1);
    });

    it('kategoria spoza enuma nie daje premii', () => {
        const boost = calculateRelevanceBoost(candidate({ category: 'government', name: 'Urzad' }), 'urzad', 'government');

        // 'government' nie istnieje w categoryEnum — zostaje sama premia za nazwe.
        expect(boost).toBeCloseTo(1.2);
    });

    it('puste zapytanie nie powoduje dzielenia przez zero', () => {
        const boost = calculateRelevanceBoost(candidate(), '   ', null);

        expect(boost).toBe(1);
        expect(Number.isNaN(boost)).toBe(false);
    });
});

describe('selectRelevant', () => {
    it('zwraca wyniki powyzej progu ustawione wedlug wyniku z premia', () => {
        const results = selectRelevant(
            [
                candidate({ name: 'Slabszy', relevanceScore: 0.4 }),
                candidate({ name: 'Mocniejszy', relevanceScore: 0.6 }),
            ],
            'zapytanie',
            null,
            10,
        );

        expect(results.map(r => r.name)).toEqual(['Mocniejszy', 'Slabszy']);
    });

    it('odsiewa wyniki ponizej progu', () => {
        const results = selectRelevant(
            [
                candidate({ name: 'Nad progiem', relevanceScore: RELEVANCE_FLOOR + 0.01 }),
                candidate({ name: 'Pod progiem', relevanceScore: RELEVANCE_FLOOR - 0.01 }),
            ],
            'zapytanie',
            null,
            10,
        );

        expect(results.map(r => r.name)).toEqual(['Nad progiem']);
    });

    it('wynik dokladnie na progu przechodzi', () => {
        const results = selectRelevant([candidate({ relevanceScore: RELEVANCE_FLOOR })], 'zapytanie', null, 10);

        expect(results).toHaveLength(1);
    });

    /**
     * Premia zmienia kolejnosc, ale nie moze wpuszczac wynikow spod progu — inaczej
     * trafienie w nazwe przepychaloby do wynikow cokolwiek.
     */
    it('premia nie przepycha wyniku spod progu ponad prog', () => {
        const results = selectRelevant(
            [candidate({ name: 'Fryzjer Anna', category: 'beauty', relevanceScore: RELEVANCE_FLOOR - 0.01 })],
            'fryzjer anna',
            'beauty',
            10,
        );

        expect(results).toEqual([]);
    });

    it('przycina do limitu', () => {
        const results = selectRelevant(
            [
                candidate({ name: 'A', relevanceScore: 0.9 }),
                candidate({ name: 'B', relevanceScore: 0.8 }),
                candidate({ name: 'C', relevanceScore: 0.7 }),
            ],
            'zapytanie',
            null,
            2,
        );

        expect(results.map(r => r.name)).toEqual(['A', 'B']);
    });

    it('limit zero zwraca pusta liste zamiast calosci', () => {
        const results = selectRelevant([candidate({ relevanceScore: 0.9 })], 'zapytanie', null, 0);

        expect(results).toEqual([]);
    });

    it('pusta lista kandydatow zwraca pusta liste', () => {
        expect(selectRelevant([], 'zapytanie', null, 5)).toEqual([]);
    });

    it('zachowuje pola kandydata i dokłada boostedScore', () => {
        const [result] = selectRelevant([candidate({ name: 'Firma', relevanceScore: 0.5 })], 'zapytanie', null, 1);

        expect(result.name).toBe('Firma');
        expect(result.boostedScore).toBeCloseTo(0.5);
    });
});
