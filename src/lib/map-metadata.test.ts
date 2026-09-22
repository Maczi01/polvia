import { locales } from '@/i18n/config';
import { buildMapMetadataPath, buildMapTitleSuffix } from '@/lib/map-metadata';
import type { MapFilters } from '@/lib/map-slug-parser';

const NO_FILTERS: MapFilters = { category: null, county: null, city: null, onlineOnly: false };
const BEAUTY_WARSAW: MapFilters = { ...NO_FILTERS, category: 'beauty', city: 'warszawa' };

const LABELS = {
    category: (key: string) => `cat:${key}`,
    online: 'Online',
    location: (key: string) => `loc:${key}`,
};

describe('buildMapMetadataPath', () => {
    it('kategoria + miasto daje sciezke z miastem (pl)', () => {
        expect(buildMapMetadataPath(BEAUTY_WARSAW, 'pl')).toBe('/mapa/uroda/warszawa');
    });

    it('samo miasto daje /mapa/{miasto}', () => {
        expect(buildMapMetadataPath({ ...NO_FILTERS, city: 'warszawa' }, 'pl')).toBe(
            '/mapa/warszawa',
        );
    });

    it('miasto z diakrytykami trafia do sciezki jako slug ASCII', () => {
        expect(buildMapMetadataPath({ ...NO_FILTERS, city: 'kraków' }, 'en')).toBe(
            '/en/map/krakow',
        );
    });

    it('kazde locale dostaje wlasny prefiks i slug kategorii', () => {
        expect(buildMapMetadataPath(BEAUTY_WARSAW, 'en')).toBe('/en/map/beauty/warszawa');
        expect(buildMapMetadataPath(BEAUTY_WARSAW, 'uk')).toBe('/uk/map/krasa/warszawa');
        expect(buildMapMetadataPath(BEAUTY_WARSAW, 'ru')).toMatch(/^\/ru\/map\/[^/]+\/warszawa$/);
    });

    it('canonical strony miejskiej rozni sie od canonicalu samej kategorii', () => {
        for (const locale of locales) {
            expect(buildMapMetadataPath(BEAUTY_WARSAW, locale)).not.toBe(
                buildMapMetadataPath({ ...NO_FILTERS, category: 'beauty' }, locale),
            );
        }
    });

    it('zadne locale poza en nie dostaje prefiksu /en', () => {
        for (const locale of locales.filter(l => l !== 'en')) {
            expect(buildMapMetadataPath(BEAUTY_WARSAW, locale)).not.toMatch(/^\/en\//);
        }
    });

    it('bez filtrow daje bazowa sciezke mapy', () => {
        expect(buildMapMetadataPath(NO_FILTERS, 'pl')).toBe('/mapa');
        expect(buildMapMetadataPath(NO_FILTERS, 'uk')).toBe('/uk/map');
    });
});

describe('buildMapTitleSuffix', () => {
    it('kategoria + miasto daje "Kategoria, Miasto"', () => {
        expect(buildMapTitleSuffix(BEAUTY_WARSAW, LABELS)).toBe(' - cat:Beauty, loc:warszawa');
    });

    it('samo miasto trafia do sufiksu', () => {
        expect(buildMapTitleSuffix({ ...NO_FILTERS, city: 'warszawa' }, LABELS)).toBe(
            ' - loc:warszawa',
        );
    });

    it('sufiks strony miejskiej rozni sie od sufiksu samej kategorii', () => {
        expect(buildMapTitleSuffix(BEAUTY_WARSAW, LABELS)).not.toBe(
            buildMapTitleSuffix({ ...NO_FILTERS, category: 'beauty' }, LABELS),
        );
    });

    it('wojewodztwo i zasieg nadal trafiaja do sufiksu', () => {
        expect(buildMapTitleSuffix({ ...NO_FILTERS, county: 'pomorskie' }, LABELS)).toBe(
            ' - loc:pomorskie',
        );
        expect(buildMapTitleSuffix({ ...NO_FILTERS, category: 'law', onlineOnly: true }, LABELS)).toBe(
            ' - cat:Law, Online',
        );
    });

    it('bez filtrow sufiks jest pusty', () => {
        expect(buildMapTitleSuffix(NO_FILTERS, LABELS)).toBe('');
    });
});
