import { legacyMapRedirectPath } from '@/lib/legacy-map-redirect';

describe('legacyMapRedirectPath', () => {
    it('zwraca null dla URL-a bez starych parametrow', () => {
        expect(legacyMapRedirectPath({ query: 'notariusz' }, 'pl')).toBeNull();
    });

    it('przenosi kategorie do sluga, a query i lang do parametrow', () => {
        expect(
            legacyMapRedirectPath({ category: 'law', query: 'notariusz', lang: 'uk' }, 'en'),
        ).toBe('/en/map/law?query=notariusz&lang=uk');
    });

    it('przy powtorzonym parametrze bierze pierwsza wartosc zamiast rzucac', () => {
        expect(
            legacyMapRedirectPath(
                {
                    category: 'law',
                    query: ['notariusz', 'tlumacz'],
                    place: ['krakow', 'gdansk'],
                    view: ['list', 'map'],
                    lang: ['uk', 'ru'],
                },
                'pl',
            ),
        ).toBe('/mapa/prawne?query=notariusz&place=krakow&view=list&lang=uk');
    });
});
