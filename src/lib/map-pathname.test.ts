import { parseMapPathname } from '@/lib/map-pathname';

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
