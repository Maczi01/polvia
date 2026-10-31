import { locales } from '@/i18n/config';

import {
    buildServiceProfilePath,
    isReservedRootSegment,
    isValidServiceSlug,
    parseServiceProfilePathname,
    SERVICE_PROFILE_NOT_FOUND_PATH,
} from './service-profile-path';

describe('SERVICE_PROFILE_NOT_FOUND_PATH', () => {
    it('nie jest adresem profilu — trasa [locale]/firma/[slug] go nie dopasuje', () => {
        expect(SERVICE_PROFILE_NOT_FOUND_PATH.split('/')).toHaveLength(5);
        expect(parseServiceProfilePathname(SERVICE_PROFILE_NOT_FOUND_PATH)).toBeNull();
    });

    it('lezy w poddrzewie profilu z jawnym locale (rewrite omija next-intl)', () => {
        expect(SERVICE_PROFILE_NOT_FOUND_PATH).toMatch(/^\/pl\/firma\/_[^/]+\/_[^/]+$/);
    });
});

describe('parseServiceProfilePathname', () => {
    it('/firma/<slug> to locale pl bez prefiksu', () => {
        expect(parseServiceProfilePathname('/firma/abc')).toEqual({ locale: 'pl', slug: 'abc' });
    });

    it('/{locale}/firma/<slug> rozpoznaje locale z prefiksu', () => {
        expect(parseServiceProfilePathname('/uk/firma/abc')).toEqual({ locale: 'uk', slug: 'abc' });
        expect(parseServiceProfilePathname('/en/firma/abc')).toEqual({ locale: 'en', slug: 'abc' });
    });

    it.each(['/firma', '/firma/', '/firma/a/b', '/uk/firma/', '/uk/firma/a/b', '/', '/mapa/abc'])(
        '%s nie jest profilem',
        pathname => {
            expect(parseServiceProfilePathname(pathname)).toBeNull();
        },
    );

    it('prefiks spoza listy locale nie jest profilem', () => {
        expect(parseServiceProfilePathname('/de/firma/abc')).toBeNull();
    });

    it('oddaje surowy segment — format sprawdza osobna funkcja', () => {
        expect(parseServiceProfilePathname('/firma/ABC')).toEqual({ locale: 'pl', slug: 'ABC' });
    });
});

describe('isValidServiceSlug', () => {
    it.each(['abc', 'kancelaria-nowak', 'firma-2', 'a1-b2-c3'])('%s ma format slugu', slug => {
        expect(isValidServiceSlug(slug)).toBe(true);
    });

    it.each(['ABC', '-abc', 'abc-', 'a--b', 'a_b', 'a.b', 'zażółć', '%C5%82', ''])(
        '%s nie ma formatu slugu',
        slug => {
            expect(isValidServiceSlug(slug)).toBe(false);
        },
    );

    it('odrzuca slug dluzszy niz kolumna services.slug', () => {
        expect(isValidServiceSlug('a'.repeat(255))).toBe(true);
        expect(isValidServiceSlug('a'.repeat(256))).toBe(false);
    });
});

describe('buildServiceProfilePath', () => {
    it('pl bez prefiksu, pozostale locale z prefiksem', () => {
        expect(buildServiceProfilePath('pl', 'x')).toBe('/firma/x');
        expect(buildServiceProfilePath('ru', 'x')).toBe('/ru/firma/x');
        expect(buildServiceProfilePath('uk', 'x')).toBe('/uk/firma/x');
        expect(buildServiceProfilePath('en', 'x')).toBe('/en/firma/x');
    });

    it('zadne locale poza en nie dostaje prefiksu /en', () => {
        for (const locale of locales.filter(item => item !== 'en')) {
            expect(buildServiceProfilePath(locale, 'x')).not.toMatch(/^\/en\//);
        }
    });

    it('sciezka zbudowana jest rozpoznawana przez parser (round-trip)', () => {
        for (const locale of locales) {
            const path = buildServiceProfilePath(locale, 'kancelaria-nowak');
            expect(parseServiceProfilePathname(path)).toEqual({ locale, slug: 'kancelaria-nowak' });
        }
    });
});

describe('isReservedRootSegment', () => {
    it.each(['mapa', 'cennik', 'pricing', 'blog', 'en', 'api', 'firma', 'services', 'privacy'])(
        '%s jest zarezerwowany',
        segment => {
            expect(isReservedRootSegment(segment)).toBe(true);
        },
    );

    it.each(['pl', 'ru', 'uk', 'map', 'kontakt', 'contact', 'dodaj-firme', 'add-business'])(
        '%s (locale albo trasa z routing.pathnames) jest zarezerwowany',
        segment => {
            expect(isReservedRootSegment(segment)).toBe(true);
        },
    );

    it.each(['regulamin', 'terms', 'ciasteczka', 'cookies', 'dashboard', 'thanks', 'action'])(
        '%s jest zarezerwowany',
        segment => {
            expect(isReservedRootSegment(segment)).toBe(true);
        },
    );

    it.each(['year', 'month', 'images', 'logo', '_next', '_vercel'])(
        '%s (przekierowanie, public/ albo Next) jest zarezerwowany',
        segment => {
            expect(isReservedRootSegment(segment)).toBe(true);
        },
    );

    it.each(['kancelaria-nowak', 'psychodnia', 'firma-2', ''])('%s nie jest zarezerwowany', segment => {
        expect(isReservedRootSegment(segment)).toBe(false);
    });
});
