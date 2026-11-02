import { contactAlternates, contactUrl } from './contact-urls';

const BASE = 'https://www.polvia.pl';

describe('contactUrl', () => {
    it('pl to sciezka bez prefiksu', () => {
        expect(contactUrl(BASE, 'pl')).toBe(`${BASE}/kontakt`);
    });

    it.each(['en', 'ru', 'uk'] as const)('%s ma wlasny prefiks', locale => {
        expect(contactUrl(BASE, locale)).toBe(`${BASE}/${locale}/contact`);
    });

    it('zadne locale poza en nie dostaje sciezki z /en', () => {
        for (const locale of ['pl', 'ru', 'uk'] as const) {
            expect(contactUrl(BASE, locale)).not.toContain('/en/');
        }
    });
});

describe('contactAlternates', () => {
    it('canonical w locale strony, alternates dla 4 locale i x-default na pl', () => {
        expect(contactAlternates(BASE, 'ru')).toEqual({
            canonical: `${BASE}/ru/contact`,
            languages: {
                'x-default': `${BASE}/kontakt`,
                pl: `${BASE}/kontakt`,
                en: `${BASE}/en/contact`,
                ru: `${BASE}/ru/contact`,
                uk: `${BASE}/uk/contact`,
            },
        });
    });
});
