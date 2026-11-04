import { getStarFillPercent } from './rating-star-fill';

describe('getStarFillPercent', () => {
    it('ocena 4,6: cztery pelne gwiazdki i piata wypelniona w 60%', () => {
        expect([1, 2, 3, 4, 5].map(position => getStarFillPercent(4.6, position))).toEqual([
            100, 100, 100, 100, 60,
        ]);
    });

    it('ocena calkowita nie ma czesciowo wypelnionej gwiazdki', () => {
        expect([1, 2, 3, 4, 5].map(position => getStarFillPercent(4, position))).toEqual([
            100, 100, 100, 100, 0,
        ]);
    });

    it('zaokragla do pelnego procenta (4,25 → 25%, 4,333 → 33%)', () => {
        expect(getStarFillPercent(4.25, 5)).toBe(25);
        expect(getStarFillPercent(4.333, 5)).toBe(33);
    });

    it('ocena 0 to same puste gwiazdki, ocena 5 same pelne', () => {
        expect([1, 2, 3, 4, 5].map(position => getStarFillPercent(0, position))).toEqual([
            0, 0, 0, 0, 0,
        ]);
        expect([1, 2, 3, 4, 5].map(position => getStarFillPercent(5, position))).toEqual([
            100, 100, 100, 100, 100,
        ]);
    });
});
