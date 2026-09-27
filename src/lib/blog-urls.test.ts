import { locales } from '@/i18n/config';

import { blogPath } from './blog-urls';

describe('blogPath', () => {
    it('dla domyslnego pl nie ma prefiksu — /pl/blog odpowiada 307', () => {
        expect(blogPath('pl', 'mapa-ukrainskich-firm')).toBe('/blog/mapa-ukrainskich-firm');
    });

    it('dla pozostalych locale dokleja wlasny prefiks', () => {
        expect(blogPath('uk', 'mapa-ukrainskich-firm')).toBe('/uk/blog/mapa-ukrainskich-firm');
        expect(blogPath('ru', 'mapa-ukrainskich-firm')).toBe('/ru/blog/mapa-ukrainskich-firm');
        expect(blogPath('en', 'mapa-ukrainskich-firm')).toBe('/en/blog/mapa-ukrainskich-firm');
    });

    it('bez sluga zwraca liste wpisow', () => {
        expect(blogPath('pl')).toBe('/blog');
        expect(blogPath('uk')).toBe('/uk/blog');
    });

    it('zadne locale nie dostaje cudzego prefiksu ani /pl', () => {
        for (const locale of locales) {
            const path = blogPath(locale, 'x');
            expect(path).not.toMatch(/^\/pl\//);
            if (locale !== 'pl') expect(path.startsWith(`/${locale}/`)).toBe(true);
        }
    });
});
