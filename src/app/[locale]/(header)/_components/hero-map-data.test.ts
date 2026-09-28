import { HERO_PINS, type HeroPinDefinition, withVoivodeshipStats } from './hero-map-data';

function pin(voivodeshipKey: string): HeroPinDefinition {
    return {
        svgLabel: voivodeshipKey,
        categoryKey: 'law',
        icon: '/icons/law.svg',
        variant: 'gold',
        position: { x: 0, y: 0 },
        voivodeship: voivodeshipKey,
        voivodeshipKey,
    };
}

describe('withVoivodeshipStats', () => {
    it('dokleja liczby z bazy do pinu wojewodztwa', () => {
        const [result] = withVoivodeshipStats(
            [pin('pomorskie')],
            [{ voivodeship: 'pomorskie', companiesCount: 7, categoriesCount: 3 }],
        );

        expect(result).toMatchObject({ voivodeshipKey: 'pomorskie', placesCount: 7, categoriesCount: 3 });
    });

    it('wojewodztwo bez aktywnych firm dostaje zero, a nie liczbe z pliku', () => {
        const [result] = withVoivodeshipStats([pin('opolskie')], []);

        expect(result?.placesCount).toBe(0);
        expect(result?.categoriesCount).toBe(0);
    });

    it('zachowuje kolejnosc i liczbe pinow', () => {
        const result = withVoivodeshipStats(HERO_PINS, []);

        expect(result.map(p => p.svgLabel)).toEqual(HERO_PINS.map(p => p.svgLabel));
    });
});

describe('HERO_PINS', () => {
    it('nie zawiera zmyslonych liczb ani przykladowych firm', () => {
        for (const definition of HERO_PINS) {
            expect(Object.keys(definition)).not.toEqual(
                expect.arrayContaining(['placesCount', 'exampleCompanies']),
            );
        }
    });
});
