import { type FeaturedCandidate, pickFeaturedServices } from '@/lib/featured-services';

function candidate(serviceId: string): FeaturedCandidate {
    return { serviceId, name: `Firma ${serviceId}`, category: 'law', city: 'Kraków' };
}

describe('pickFeaturedServices', () => {
    it('bierze dwie popularne i jedna najnowsza', () => {
        const result = pickFeaturedServices(
            [candidate('a'), candidate('b'), candidate('c')],
            [candidate('x'), candidate('y')],
        );

        expect(result.map(s => [s.serviceId, s.reason])).toEqual([
            ['a', 'popular'],
            ['b', 'popular'],
            ['x', 'new'],
        ]);
    });

    it('pomija najnowsza, ktora jest juz wsrod popularnych', () => {
        const result = pickFeaturedServices(
            [candidate('a'), candidate('b')],
            [candidate('b'), candidate('y')],
        );

        expect(result.map(s => s.serviceId)).toEqual(['a', 'b', 'y']);
    });

    it('zwraca pusta liste dla pustej bazy', () => {
        expect(pickFeaturedServices([], [])).toEqual([]);
    });

    it('nie dokleja nowej firmy, gdy wszystkie najnowsze sa juz wybrane', () => {
        const result = pickFeaturedServices([candidate('a')], [candidate('a')]);

        expect(result).toEqual([{ ...candidate('a'), reason: 'popular' }]);
    });
});
