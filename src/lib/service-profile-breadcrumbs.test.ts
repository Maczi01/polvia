import { locales } from '@/i18n/config';

import {
    buildBreadcrumbJsonLd,
    buildHomePath,
    buildProfileBreadcrumbs,
    type ProfileBreadcrumbsInput,
} from './service-profile-breadcrumbs';

const BASE_URL = 'https://polvia.pl';

function input(overrides: Partial<ProfileBreadcrumbsInput> = {}): ProfileBreadcrumbsInput {
    return {
        locale: 'pl',
        siteName: 'Polvia',
        category: 'health',
        categoryLabel: 'Zdrowie',
        city: 'Warszawa',
        name: 'Twój Lekarz',
        slug: 'twoj-lekarz-warszawa',
        ...overrides,
    };
}

describe('buildHomePath', () => {
    it('pl bez prefiksu, reszta z prefiksem locale', () => {
        expect(buildHomePath('pl')).toBe('/');
        expect(buildHomePath('uk')).toBe('/uk');
    });
});

describe('buildProfileBreadcrumbs', () => {
    it('pl: strona glowna, kategoria, miasto i firma; mapa pod /mapa', () => {
        expect(buildProfileBreadcrumbs(input())).toEqual([
            { label: 'Polvia', href: '/' },
            { label: 'Zdrowie', href: '/mapa/zdrowie' },
            { label: 'Warszawa', href: '/mapa/zdrowie/warszawa' },
            { label: 'Twój Lekarz', href: '/firma/twoj-lekarz-warszawa' },
        ]);
    });

    it('uk: prefiks /uk, sciezka /map i slug kategorii w locale', () => {
        expect(
            buildProfileBreadcrumbs(
                input({ locale: 'uk', categoryLabel: 'Здоровʼя', city: 'Kraków' }),
            ),
        ).toEqual([
            { label: 'Polvia', href: '/uk' },
            { label: 'Здоровʼя', href: '/uk/map/zdorovya' },
            { label: 'Kraków', href: '/uk/map/zdorovya/krakow' },
            { label: 'Twój Lekarz', href: '/uk/firma/twoj-lekarz-warszawa' },
        ]);
    });

    it('wpis bez miasta (online) nie ma okruszka miasta', () => {
        const crumbs = buildProfileBreadcrumbs(input({ city: null }));

        expect(crumbs.map(crumb => crumb.label)).toEqual(['Polvia', 'Zdrowie', 'Twój Lekarz']);
    });

    it('miasto bez filtra na mapie nie ma okruszka (URL przekierowalby na sama mape)', () => {
        const crumbs = buildProfileBreadcrumbs(input({ city: 'Chróścice' }));

        expect(crumbs.map(crumb => crumb.label)).toEqual(['Polvia', 'Zdrowie', 'Twój Lekarz']);
    });

    it('zadne locale poza en nie dostaje sciezki z /en', () => {
        for (const locale of locales.filter(l => l !== 'en')) {
            for (const crumb of buildProfileBreadcrumbs(input({ locale }))) {
                expect(crumb.href).not.toMatch(/^\/en(\/|$)/);
            }
        }
    });
});

describe('buildBreadcrumbJsonLd', () => {
    it('pozycje 1..n z absolutnymi adresami; pl bez prefiksu', () => {
        const jsonLd = buildBreadcrumbJsonLd(buildProfileBreadcrumbs(input()), BASE_URL);

        expect(jsonLd).toEqual({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Polvia', item: 'https://polvia.pl/' },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Zdrowie',
                    item: 'https://polvia.pl/mapa/zdrowie',
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    name: 'Warszawa',
                    item: 'https://polvia.pl/mapa/zdrowie/warszawa',
                },
                {
                    '@type': 'ListItem',
                    position: 4,
                    name: 'Twój Lekarz',
                    item: 'https://polvia.pl/firma/twoj-lekarz-warszawa',
                },
            ],
        });
    });

    it('uk: kazdy adres z /uk', () => {
        const serialized = JSON.stringify(
            buildBreadcrumbJsonLd(buildProfileBreadcrumbs(input({ locale: 'uk' })), BASE_URL),
        );

        expect(serialized).toContain('"item":"https://polvia.pl/uk"');
        expect(serialized).toContain('https://polvia.pl/uk/map/zdorovya/warszawa');
        expect(serialized).toContain('https://polvia.pl/uk/firma/twoj-lekarz-warszawa');
    });

    it.each(['pl', 'ru', 'uk'] as const)('%s: brak adresu z /en', locale => {
        const serialized = JSON.stringify(
            buildBreadcrumbJsonLd(buildProfileBreadcrumbs(input({ locale })), BASE_URL),
        );

        expect(serialized).not.toContain('polvia.pl/en');
    });

    it('pozycja bez sciezki nie dostaje item', () => {
        const jsonLd = buildBreadcrumbJsonLd([{ label: 'Tekst', href: null }], BASE_URL);

        expect(jsonLd.itemListElement).toEqual([
            { '@type': 'ListItem', position: 1, name: 'Tekst' },
        ]);
    });
});
