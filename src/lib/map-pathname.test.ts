import { mapFiltersFromPathname, parseMapPathname } from '@/lib/map-pathname';

describe('parseMapPathname — rozbior sciezki mapy', () => {
    it('rozpoznaje /mapa/{slug} jako locale pl', () => {
        expect(parseMapPathname('/mapa/prawne')).toEqual({ locale: 'pl', slug: ['prawne'] });
    });

    it('rozpoznaje dwa segmenty', () => {
        expect(parseMapPathname('/mapa/prawne/online')).toEqual({
            locale: 'pl',
            slug: ['prawne', 'online'],
        });
    });

    it('rozpoznaje prefiksowane locale', () => {
        expect(parseMapPathname('/en/map/law')).toEqual({ locale: 'en', slug: ['law'] });
        expect(parseMapPathname('/ru/map/online')).toEqual({ locale: 'ru', slug: ['online'] });
        expect(parseMapPathname('/uk/map/online')).toEqual({ locale: 'uk', slug: ['online'] });
    });

    it('zwraca null dla samej mapy bez slugu — nie ma czego walidowac', () => {
        expect(parseMapPathname('/mapa')).toBeNull();
        expect(parseMapPathname('/en/map')).toBeNull();
    });

    it('zwraca null dla sciezek niebedacych mapa', () => {
        expect(parseMapPathname('/blog/wpis')).toBeNull();
        expect(parseMapPathname('/kontakt')).toBeNull();
        expect(parseMapPathname('/')).toBeNull();
        expect(parseMapPathname('/dashboard/services')).toBeNull();
    });

    it('zwraca null dla nieznanego prefiksu dwuliterowego', () => {
        // /de/ nie jest wspieranym locale — nie wolno tego traktowac jak mape
        expect(parseMapPathname('/de/map/law')).toBeNull();
    });

    it('nie myli /mapa z podobnymi sciezkami', () => {
        expect(parseMapPathname('/mapamania/cos')).toBeNull();
        expect(parseMapPathname('/en/mapping/law')).toBeNull();
    });
});

describe('mapFiltersFromPathname — filtry z adresu przegladarki', () => {
    const noFilters = { category: null, county: null, city: null, onlineOnly: false };

    it('sciezka bazowa daje brak filtrow we wszystkich locale', () => {
        expect(mapFiltersFromPathname('/mapa', 'pl')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/en/map', 'en')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/ru/map', 'ru')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/uk/map', 'uk')).toEqual(noFilters);
    });

    it('rozpoznaje sama kategorie w slugu wlasciwym dla locale', () => {
        const grocery = { ...noFilters, category: 'grocery' };
        expect(mapFiltersFromPathname('/mapa/spozywcze', 'pl')).toEqual(grocery);
        expect(mapFiltersFromPathname('/en/map/grocery', 'en')).toEqual(grocery);
        expect(mapFiltersFromPathname('/ru/map/produkty', 'ru')).toEqual(grocery);
        expect(mapFiltersFromPathname('/uk/map/produkty', 'uk')).toEqual(grocery);
    });

    it('rozpoznaje samo wojewodztwo', () => {
        expect(mapFiltersFromPathname('/mapa/malopolskie', 'pl')).toEqual({
            ...noFilters,
            county: 'malopolskie',
        });
    });

    it('rozpoznaje samo miasto i oddaje jego nazwe', () => {
        expect(mapFiltersFromPathname('/uk/map/krakow', 'uk')).toEqual({
            ...noFilters,
            city: 'kraków',
        });
    });

    it('rozpoznaje zasieg online', () => {
        expect(mapFiltersFromPathname('/mapa/online', 'pl')).toEqual({
            ...noFilters,
            onlineOnly: true,
        });
    });

    it('rozpoznaje kategorie z wojewodztwem', () => {
        expect(mapFiltersFromPathname('/mapa/prawne/malopolskie', 'pl')).toEqual({
            ...noFilters,
            category: 'law',
            county: 'malopolskie',
        });
    });

    it('segment smieciowy daje brak filtrow zamiast bledu', () => {
        expect(mapFiltersFromPathname('/mapa/xyz-nie-istnieje', 'pl')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/mapa/prawne/xyz', 'pl')).toEqual(noFilters);
    });

    it('slug kategorii z innego locale nie jest rozpoznawany', () => {
        expect(mapFiltersFromPathname('/mapa/grocery', 'pl')).toEqual(noFilters);
    });

    it('nie rozpoznaje mapy pod prefiksem innego locale — tylko en nosi /en', () => {
        // Zadne locale poza en nie moze przyjac sciezki z '/en'
        expect(mapFiltersFromPathname('/en/map/online', 'pl')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/en/map/online', 'ru')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/en/map/online', 'uk')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/en/map/online', 'en')).toEqual({
            ...noFilters,
            onlineOnly: true,
        });
    });

    it('nie myli mapy z podobnymi sciezkami', () => {
        expect(mapFiltersFromPathname('/mapamania/online', 'pl')).toEqual(noFilters);
        expect(mapFiltersFromPathname('/blog/online', 'pl')).toEqual(noFilters);
    });
});
