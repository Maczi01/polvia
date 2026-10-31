import {
    pickSimilarServices,
    SIMILAR_SERVICES_LIMIT,
    type SimilarService,
    type SimilarServicesSource,
} from './similar-services';

const SOURCE: SimilarServicesSource = { serviceId: 'src', category: 'legal', city: 'Warszawa' };

function service(overrides: Partial<SimilarService> & Pick<SimilarService, 'serviceId'>) {
    return {
        slug: overrides.serviceId,
        name: `Firma ${overrides.serviceId}`,
        image: null,
        city: 'Kraków',
        category: 'legal',
        ...overrides,
    };
}

describe('pickSimilarServices', () => {
    it('nie zwraca samego wpisu ani wpisow z innej kategorii', () => {
        const picked = pickSimilarServices(SOURCE, [
            service({ serviceId: 'src' }),
            service({ serviceId: 'a', category: 'health' }),
            service({ serviceId: 'b' }),
        ]);

        expect(picked.map(item => item.serviceId)).toEqual(['b']);
    });

    it('stawia firmy z tego samego miasta na poczatku, bez wzgledu na wielkosc liter', () => {
        const picked = pickSimilarServices(SOURCE, [
            service({ serviceId: 'a', name: 'Alfa', city: 'Gdańsk' }),
            service({ serviceId: 'z', name: 'Zeta', city: ' warszawa ' }),
            service({ serviceId: 'b', name: 'Beta', city: null }),
        ]);

        expect(picked.map(item => item.serviceId)).toEqual(['z', 'a', 'b']);
    });

    it('zwraca najwyzej 6 pozycji, nie wypychajac firm z tego samego miasta', () => {
        const others = Array.from({ length: 8 }, (_, index) =>
            service({ serviceId: `inne-${index}`, name: `A ${index}` }),
        );
        const local = service({ serviceId: 'lokalna', name: 'Z lokalna', city: 'Warszawa' });

        const picked = pickSimilarServices(SOURCE, [...others, local]);

        expect(SIMILAR_SERVICES_LIMIT).toBe(6);
        expect(picked).toHaveLength(SIMILAR_SERVICES_LIMIT);
        expect(picked[0]?.serviceId).toBe('lokalna');
    });

    it('zrodlo bez miasta nie promuje firm bez miasta', () => {
        const picked = pickSimilarServices({ ...SOURCE, city: null }, [
            service({ serviceId: 'b', name: 'Beta', city: null }),
            service({ serviceId: 'a', name: 'Alfa', city: 'Kraków' }),
        ]);

        expect(picked.map(item => item.serviceId)).toEqual(['a', 'b']);
    });

    it('brak kandydatow daje pusta liste', () => {
        expect(pickSimilarServices(SOURCE, [])).toEqual([]);
    });
});
