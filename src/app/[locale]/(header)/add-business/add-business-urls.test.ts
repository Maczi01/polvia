import { addBusinessAlternates, addBusinessUrl } from './add-business-urls';

const BASE = 'https://www.polvia.pl';

describe('addBusinessUrl', () => {
    it('pl to sciezka bez prefiksu', () => {
        expect(addBusinessUrl(BASE, 'pl')).toBe(`${BASE}/dodaj-firme`);
    });

    it.each(['en', 'ru', 'uk'] as const)('%s ma wlasny prefiks', locale => {
        expect(addBusinessUrl(BASE, locale)).toBe(`${BASE}/${locale}/add-business`);
    });

    it('zadne locale poza en nie dostaje sciezki z /en', () => {
        for (const locale of ['pl', 'ru', 'uk'] as const) {
            expect(addBusinessUrl(BASE, locale)).not.toContain('/en/');
        }
    });
});

describe('addBusinessAlternates', () => {
    it('canonical w locale strony, alternates dla 4 locale i x-default na pl', () => {
        expect(addBusinessAlternates(BASE, 'uk')).toEqual({
            canonical: `${BASE}/uk/add-business`,
            languages: {
                'x-default': `${BASE}/dodaj-firme`,
                pl: `${BASE}/dodaj-firme`,
                en: `${BASE}/en/add-business`,
                ru: `${BASE}/ru/add-business`,
                uk: `${BASE}/uk/add-business`,
            },
        });
    });
});
