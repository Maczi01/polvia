import { locales } from '@/i18n/config';

import {
    buildProfileCanonicalUrl,
    buildProfileLanguageAlternates,
    buildProfileMetadata,
    buildProfileTitle,
    META_DESCRIPTION_MAX_LENGTH,
    type ProfileMetadataInput,
    PROFILE_TITLE_MAX_LENGTH,
    selectFallbackDescriptionKey,
    truncateMetaDescription,
} from './service-profile-metadata';

const BASE_URL = 'https://polvia.pl';

describe('buildProfileCanonicalUrl', () => {
    it('pl nie ma prefiksu locale', () => {
        expect(buildProfileCanonicalUrl(BASE_URL, 'pl', 'x')).toBe('https://polvia.pl/firma/x');
    });

    it('ru dostaje prefiks /ru', () => {
        expect(buildProfileCanonicalUrl(BASE_URL, 'ru', 'x')).toBe('https://polvia.pl/ru/firma/x');
    });
});

describe('buildProfileLanguageAlternates', () => {
    const alternates = buildProfileLanguageAlternates(BASE_URL, 'x');

    it('ma wszystkie 4 locale i x-default', () => {
        expect(Object.keys(alternates).sort()).toEqual(['en', 'pl', 'ru', 'uk', 'x-default']);
        expect(alternates).toEqual({
            pl: 'https://polvia.pl/firma/x',
            en: 'https://polvia.pl/en/firma/x',
            ru: 'https://polvia.pl/ru/firma/x',
            uk: 'https://polvia.pl/uk/firma/x',
            'x-default': 'https://polvia.pl/firma/x',
        });
    });

    it('zadne locale poza en nie dostaje sciezki z /en', () => {
        for (const locale of locales.filter(l => l !== 'en')) {
            expect(alternates[locale]).not.toContain('/en/');
            expect(buildProfileCanonicalUrl(BASE_URL, locale, 'x')).not.toContain('/en/');
        }
        expect(alternates['x-default']).not.toContain('/en/');
    });
});

describe('buildProfileTitle', () => {
    it('sklada nazwe, kategorie i miasto', () => {
        expect(
            buildProfileTitle({
                name: 'Mistrz Remontu',
                categoryLabel: 'Remonty',
                city: 'Warszawa',
                siteName: 'Polvia',
            }),
        ).toBe('Mistrz Remontu — Remonty, Warszawa | Polvia');
    });

    it('bez miasta pomija przecinek', () => {
        expect(
            buildProfileTitle({
                name: 'Taxovia',
                categoryLabel: 'Finansowe',
                city: null,
                siteName: 'Polvia',
            }),
        ).toBe('Taxovia — Finansowe | Polvia');
    });

    it('dlugi tytul obcina na granicy slowa do 60 znakow, zostawiajac nazwe serwisu', () => {
        const title = buildProfileTitle({
            name: 'Kancelaria Adwokacka Adwokat Jan Kowalski i Wspolnicy',
            categoryLabel: 'Prawne',
            city: 'Warszawa',
            siteName: 'Polvia',
        });

        expect(title.length).toBeLessThanOrEqual(PROFILE_TITLE_MAX_LENGTH);
        expect(title).toBe('Kancelaria Adwokacka Adwokat Jan Kowalski i… | Polvia');
    });

    it('tytul rowny limitowi zostaje bez wielokropka', () => {
        const name = 'A'.repeat(PROFILE_TITLE_MAX_LENGTH - ' — B | Polvia'.length);
        const title = buildProfileTitle({
            name,
            categoryLabel: 'B',
            city: null,
            siteName: 'Polvia',
        });

        expect(title).toHaveLength(PROFILE_TITLE_MAX_LENGTH);
        expect(title).not.toContain('…');
    });
});

describe('selectFallbackDescriptionKey', () => {
    it('z miastem: opis lokalny niezaleznie od zasiegu', () => {
        expect(selectFallbackDescriptionKey('local', 'Warszawa')).toBe('descriptionLocal');
        expect(selectFallbackDescriptionKey('hybrid', 'Warszawa')).toBe('descriptionLocal');
    });

    it('online i hybrid bez miasta: opis obslugi online', () => {
        expect(selectFallbackDescriptionKey('online', null)).toBe('descriptionOnline');
        expect(selectFallbackDescriptionKey('hybrid', null)).toBe('descriptionOnline');
    });

    it('local bez miasta nie dostaje opisu „online”', () => {
        expect(selectFallbackDescriptionKey('local', null)).toBe('descriptionGeneric');
        expect(selectFallbackDescriptionKey('local', '   ')).toBe('descriptionGeneric');
    });
});

describe('truncateMetaDescription', () => {
    it('krotki tekst zostaje bez zmian (z zwinietymi bialymi znakami)', () => {
        expect(truncateMetaDescription('Remonty  mieszkań.\n\nGwarancja.')).toBe(
            'Remonty mieszkań. Gwarancja.',
        );
    });

    it('dlugi tekst obcina do limitu na granicy slowa z wielokropkiem', () => {
        const words = Array.from({ length: 60 }, (_, index) => `slowo${index}`).join(' ');

        const result = truncateMetaDescription(words);

        expect(result.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH);
        expect(result.endsWith('…')).toBe(true);
        const lastWord = result.slice(0, -1).split(' ').at(-1);
        expect(words.split(' ')).toContain(lastWord);
    });

    it('nie zostawia przecinka przed wielokropkiem', () => {
        expect(truncateMetaDescription('aaaa bbbb, cccc dddd', 12)).toBe('aaaa bbbb…');
    });

    it('jedno slowo dluzsze niz limit tnie twardo', () => {
        const result = truncateMetaDescription('a'.repeat(50), 10);

        expect(result).toBe(`${'a'.repeat(9)}…`);
    });
});

describe('buildProfileMetadata', () => {
    const FALLBACK = 'Mistrz Remontu — Remonty, Warszawa. Adres, telefon i kontakt.';

    function input(overrides: Partial<ProfileMetadataInput> = {}): ProfileMetadataInput {
        return {
            baseUrl: BASE_URL,
            locale: 'uk',
            slug: 'mistrz-remontu',
            name: 'Mistrz Remontu',
            categoryLabel: 'Remonty',
            city: 'Warszawa',
            siteName: 'Polvia',
            description: 'Remonty mieszkan pod klucz.',
            fallbackDescription: FALLBACK,
            imagePath: '/services/remont.png',
            coverImagePath: null,
            ...overrides,
        };
    }

    it('profil null daje noindex i nofollow', () => {
        expect(buildProfileMetadata(null)).toEqual({ robots: { index: false, follow: false } });
    });

    it('sklada tytul, opis, adres kanoniczny i obrazek Open Graph', () => {
        const metadata = buildProfileMetadata(input());

        expect(metadata.title).toBe('Mistrz Remontu — Remonty, Warszawa | Polvia');
        expect(metadata.description).toBe('Remonty mieszkan pod klucz.');
        expect(metadata.robots).toEqual({ index: true, follow: true });
        expect(metadata.alternates?.canonical).toBe(`${BASE_URL}/uk/firma/mistrz-remontu`);
        expect(metadata.openGraph).toMatchObject({
            url: `${BASE_URL}/uk/firma/mistrz-remontu`,
            locale: 'uk',
            alternateLocale: locales.filter(locale => locale !== 'uk'),
            images: [{ url: `${BASE_URL}/services/remont.png`, alt: 'Mistrz Remontu' }],
        });
    });

    it.each([
        ['null', null],
        ['pusty', ''],
        ['bialy', '   '],
    ])('opis %s daje opis zastepczy, nie pusty <meta description>', (_label, description) => {
        const metadata = buildProfileMetadata(input({ description }));

        expect(metadata.description).toBe(FALLBACK);
        expect(metadata.openGraph?.description).toBe(FALLBACK);
    });

    it('brak logo nie dodaje obrazka do Open Graph', () => {
        const metadata = buildProfileMetadata(input({ imagePath: null }));

        expect(metadata.openGraph?.images).toBeUndefined();
    });

    it('widok premium z coverem: cover zamiast logo w Open Graph', () => {
        const metadata = buildProfileMetadata(
            input({ coverImagePath: '/services/mistrz-remontu/cover.jpg' }),
        );

        expect(metadata.openGraph?.images).toEqual([
            { url: `${BASE_URL}/services/mistrz-remontu/cover.jpg`, alt: 'Mistrz Remontu' },
        ]);
    });

    it('widok free (bez coveru): obrazkiem Open Graph zostaje logo', () => {
        const metadata = buildProfileMetadata(input({ coverImagePath: null }));

        expect(metadata.openGraph?.images).toEqual([
            { url: `${BASE_URL}/services/remont.png`, alt: 'Mistrz Remontu' },
        ]);
    });

    it('hreflang: wszystkie 4 locale i x-default na wersje bez prefiksu', () => {
        const languages = buildProfileMetadata(input()).alternates?.languages;

        expect(languages).toEqual({
            pl: `${BASE_URL}/firma/mistrz-remontu`,
            en: `${BASE_URL}/en/firma/mistrz-remontu`,
            ru: `${BASE_URL}/ru/firma/mistrz-remontu`,
            uk: `${BASE_URL}/uk/firma/mistrz-remontu`,
            'x-default': `${BASE_URL}/firma/mistrz-remontu`,
        });
    });
});
