import { locales } from '@/i18n/config';

import {
    buildProfileCanonicalUrl,
    buildProfileJsonLd,
    buildProfileLanguageAlternates,
    buildProfileTitle,
    type JsonLdLocation,
    META_DESCRIPTION_MAX_LENGTH,
    serializeJsonLd,
    truncateMetaDescription,
} from './service-profile-metadata';

const BASE_URL = 'https://polvia.pl';

function location(overrides: Partial<JsonLdLocation> = {}): JsonLdLocation {
    return {
        street: 'ul. Grochowska 278',
        city: 'Warszawa',
        postcode: '03-841',
        voivodeship: 'mazowieckie',
        latitude: 52.2481,
        longitude: 21.0927,
        phoneNumber: '+48 600 100 200',
        email: 'biuro@example.pl',
        openingHours: {
            monday: { open: '08:00', close: '18:00' },
            saturday: { open: '09:00', close: '13:00' },
        },
        ...overrides,
    };
}

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
            buildProfileTitle({ name: 'Taxovia', categoryLabel: 'Finansowe', city: null, siteName: 'Polvia' }),
        ).toBe('Taxovia — Finansowe | Polvia');
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

describe('buildProfileJsonLd', () => {
    const common = {
        name: 'Mistrz Remontu',
        description: 'Remonty',
        url: 'https://polvia.pl/firma/mistrz-remontu',
        imageUrl: 'https://polvia.pl/services/logo.png',
        sameAs: ['https://facebook.com/mistrz'],
    };

    it('wpis lokalny to LocalBusiness z PostalAddress, geo i godzinami', () => {
        const jsonLd = buildProfileJsonLd({ ...common, coverage: 'local', location: location() });

        expect(jsonLd['@type']).toBe('LocalBusiness');
        expect(jsonLd.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: 'ul. Grochowska 278',
            addressLocality: 'Warszawa',
            postalCode: '03-841',
            addressRegion: 'mazowieckie',
            addressCountry: 'PL',
        });
        expect(jsonLd.geo).toEqual({
            '@type': 'GeoCoordinates',
            latitude: 52.2481,
            longitude: 21.0927,
        });
        expect(jsonLd.openingHoursSpecification).toEqual([
            {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: 'https://schema.org/Monday',
                opens: '08:00',
                closes: '18:00',
            },
            {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: 'https://schema.org/Saturday',
                opens: '09:00',
                closes: '13:00',
            },
        ]);
        expect(jsonLd.telephone).toBe('+48 600 100 200');
        expect(jsonLd.sameAs).toEqual(['https://facebook.com/mistrz']);
    });

    it('wpis online to Organization bez address, geo i godzin', () => {
        const jsonLd = buildProfileJsonLd({ ...common, coverage: 'online', location: location() });

        expect(jsonLd['@type']).toBe('Organization');
        expect(jsonLd).not.toHaveProperty('address');
        expect(jsonLd).not.toHaveProperty('geo');
        expect(jsonLd).not.toHaveProperty('openingHoursSpecification');
        expect(jsonLd.email).toBe('biuro@example.pl');
    });

    it('wpis bez wspolrzednych nie ma geo, a puste pola sa pominiete', () => {
        const jsonLd = buildProfileJsonLd({
            ...common,
            description: null,
            imageUrl: null,
            sameAs: [],
            coverage: 'hybrid',
            location: location({ latitude: null, longitude: null, openingHours: {}, email: null }),
        });

        expect(jsonLd['@type']).toBe('LocalBusiness');
        expect(jsonLd).not.toHaveProperty('geo');
        expect(jsonLd).not.toHaveProperty('description');
        expect(jsonLd).not.toHaveProperty('image');
        expect(jsonLd).not.toHaveProperty('sameAs');
        expect(jsonLd).not.toHaveProperty('email');
        expect(jsonLd).not.toHaveProperty('openingHoursSpecification');
    });
});

describe('serializeJsonLd', () => {
    it('nie przepuszcza </script> z opisu i daje poprawny JSON', () => {
        const data = { description: 'Opis</script><script>alert(1)</script>' };

        const serialized = serializeJsonLd(data);

        expect(serialized).not.toContain('</script>');
        expect(serialized).not.toContain('<');
        expect(JSON.parse(serialized)).toEqual(data);
    });
});
