import { createTranslator } from 'next-intl';

import type { Locale } from '@/i18n/config';
import type { ServiceLanguage } from '@/lib/languages';

import en from '../../messages/en.json';
import pl from '../../messages/pl.json';
import ru from '../../messages/ru.json';
import uk from '../../messages/uk.json';
import { buildLanguageMetaTexts } from './service-profile-languages';
import { buildProfileTitle, PROFILE_TITLE_MAX_LENGTH } from './service-profile-title';

/** Typ `pl` dla wszystkich locale: klucze tlumaczen musza byc identyczne. */
const MESSAGES: Record<Locale, typeof pl> = { pl, en, ru, uk };

type TitleCase = {
    locale: Locale;
    name: string;
    category: string;
    city: string | null;
    languages: ServiceLanguage[];
};

/** Tytul jak w `generateMetadata`: fraza z prawdziwych tlumaczen danego locale. */
function title({ locale, name, category, city, languages }: TitleCase): string {
    const t = createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'ServiceProfile.meta',
    });
    const { titlePhrase } = buildLanguageMetaTexts(t, locale, languages, category);
    return buildProfileTitle({
        name,
        categoryLabel: 'Etykieta',
        city,
        siteName: 'Polvia',
        titlePhrase,
    });
}

describe('buildProfileTitle z jezykiem obslugi', () => {
    it.each([
        ['pl', 'Multi Cook — ukraiński sklep spożywczy, Warszawa | Polvia'],
        ['en', 'Multi Cook — Ukrainian grocery store, Warszawa | Polvia'],
    ] as const)('%s: przymiotnik przed rzeczownikiem, z miastem', (locale, expected) => {
        expect(
            title({
                locale,
                name: 'Multi Cook',
                category: 'grocery',
                city: 'Warszawa',
                languages: ['pl', 'uk', 'ru'],
            }),
        ).toBe(expected);
    });

    it.each([
        ['uk', ['pl', 'uk', 'ru'], 'Multi Cook — український продуктовий магазин | Polvia'],
        ['ru', ['pl', 'uk', 'ru'], 'Multi Cook — русскоязычный продуктовый магазин | Polvia'],
        ['ru', ['pl', 'uk'], 'Multi Cook — украинский продуктовый магазин | Polvia'],
    ] as const)('%s %p: fraza w jezyku wybranym dla locale', (locale, languages, expected) => {
        expect(
            title({
                locale,
                name: 'Multi Cook',
                category: 'grocery',
                city: null,
                languages: [...languages],
            }),
        ).toBe(expected);
    });

    describe('rodzaj i liczba przymiotnika (m, f, n, lm.)', () => {
        const CATEGORIES = ['health', 'gastronomy', 'real_estate', 'education'] as const;

        it.each([
            [
                'pl',
                'uk',
                [
                    'ukraiński lekarz',
                    'ukraińska kuchnia',
                    'ukraińskie biuro nieruchomości',
                    'ukraińskie kursy i szkoły',
                ],
            ],
            [
                'pl',
                'ru',
                [
                    'rosyjskojęzyczny lekarz',
                    'rosyjskojęzyczny lokal gastronomiczny',
                    'rosyjskojęzyczne biuro nieruchomości',
                    'rosyjskojęzyczne kursy i szkoły',
                ],
            ],
            [
                'pl',
                'be',
                [
                    'białoruski lekarz',
                    'białoruska kuchnia',
                    'białoruskie biuro nieruchomości',
                    'białoruskie kursy i szkoły',
                ],
            ],
            [
                'uk',
                'uk',
                [
                    'український лікар',
                    'українська кухня',
                    'українське агентство нерухомості',
                    'українські курси та школи',
                ],
            ],
            [
                'ru',
                'uk',
                [
                    'украинский врач',
                    'украинская кухня',
                    'украинское агентство недвижимости',
                    'украинские курсы и школы',
                ],
            ],
            [
                'ru',
                'ru',
                [
                    'русскоязычный врач',
                    'русскоязычное заведение общепита',
                    'русскоязычное агентство недвижимости',
                    'русскоязычные курсы и школы',
                ],
            ],
            [
                'en',
                'be',
                [
                    'Belarusian doctor',
                    'Belarusian cuisine',
                    'Belarusian real estate agency',
                    'Belarusian courses & schools',
                ],
            ],
        ] as const)('%s, jezyk %s', (locale, language, phrases) => {
            CATEGORIES.forEach((category, index) => {
                expect(
                    title({ locale, name: 'X', category, city: null, languages: ['pl', language] }),
                ).toBe(`X — ${phrases[index]} | Polvia`);
            });
        });
    });

    it('kubel help_support: bez przymiotnika narodowosci', () => {
        const help = (language: ServiceLanguage): string =>
            title({
                locale: 'pl',
                name: 'X',
                category: 'help_support',
                city: null,
                languages: [language],
            });

        expect(help('uk')).toBe('X — pomoc i wsparcie dla Ukraińców | Polvia');
        expect(help('ru')).toBe('X — pomoc i wsparcie po rosyjsku | Polvia');
        expect(help('be')).toBe('X — pomoc i wsparcie dla Białorusinów | Polvia');
    });

    it('bez jezykow wschodnioslowianskich: tytul jak dawniej, z etykieta kategorii', () => {
        expect(
            buildProfileTitle({
                name: 'Mistrz Remontu',
                categoryLabel: 'Remonty',
                city: 'Warszawa',
                siteName: 'Polvia',
                titlePhrase: null,
            }),
        ).toBe('Mistrz Remontu — Remonty, Warszawa | Polvia');
    });

    it('firma tylko pl: tytul bez frazy w kazdym locale', () => {
        for (const locale of ['pl', 'en', 'ru', 'uk'] as const) {
            expect(
                title({
                    locale,
                    name: 'Taxovia',
                    category: 'financial',
                    city: null,
                    languages: ['pl'],
                }),
            ).toBe('Taxovia — Etykieta | Polvia');
        }
    });

    it('dluga nazwa: skraca sie nazwa (nie ponizej minimum), fraza, miasto i sufiks zostaja', () => {
        const result = title({
            locale: 'pl',
            name: 'Kancelaria Adwokacka Nowak i Wspólnicy',
            category: 'law',
            city: 'Łódź',
            languages: ['pl', 'uk'],
        });

        expect(result.length).toBeLessThanOrEqual(PROFILE_TITLE_MAX_LENGTH);
        expect(result).toBe('Kancelaria Adwokacka… — ukraiński prawnik, Łódź | Polvia');
    });

    it('nazwa zmiescilaby sie tylko ponizej minimum: znika miasto, fraza zostaje', () => {
        const result = title({
            locale: 'pl',
            name: 'Twój Lekarz w Warszawie',
            category: 'health',
            city: 'Warszawa',
            languages: ['pl', 'uk'],
        });

        expect(result).toBe('Twój Lekarz w Warszawie — ukraiński lekarz | Polvia');
    });

    it('bardzo dluga nazwa bez miejsca na miasto: nazwa skrocona, fraza i sufiks zostaja', () => {
        const result = title({
            locale: 'pl',
            name: 'Kancelaria Adwokacka Adwokat Jan Kowalski i Wspolnicy',
            category: 'law',
            city: 'Warszawa',
            languages: ['pl', 'uk'],
        });

        expect(result.length).toBeLessThanOrEqual(PROFILE_TITLE_MAX_LENGTH);
        expect(result).toBe('Kancelaria Adwokacka Adwokat… — ukraiński prawnik | Polvia');
    });

    it('fraza zbyt dluga na nazwe: nazwa nie krotsza niz minimum, koniec obciety', () => {
        const result = buildProfileTitle({
            name: 'Centrum Medyczne Zdrowa Rodzina',
            categoryLabel: 'Pomoc i wsparcie',
            titlePhrase: 'pomoc i wsparcie po białorusku i jeszcze dluzej',
            city: 'Warszawa',
            siteName: 'Polvia',
        });

        const [namePart = ''] = result.split(' — ');
        expect(result.length).toBeLessThanOrEqual(PROFILE_TITLE_MAX_LENGTH);
        expect(result.endsWith(' | Polvia')).toBe(true);
        expect(namePart).toBe('Centrum Medyczne…');
        expect(result).toContain('…');
    });
});

describe('buildProfileTitle z kilkoma miastami', () => {
    type MultiCityCase = {
        locale: Locale;
        name: string;
        category: string;
        languages: ServiceLanguage[];
        otherCities: number;
    };

    /** Jak w `generateMetadata`: „<miasto glowne> i N inne miasta” z tlumaczen danego locale. */
    function multiCityTitle({ locale, name, category, languages, otherCities }: MultiCityCase): string {
        const t = createTranslator({
            locale,
            messages: MESSAGES[locale],
            namespace: 'ServiceProfile.meta',
        });
        const { titlePhrase } = buildLanguageMetaTexts(t, locale, languages, category);
        return buildProfileTitle({
            name,
            categoryLabel: 'Etykieta',
            city: 'Poznań',
            cityWithOthers: t('titleCityWithOthers', { city: 'Poznań', count: otherCities }),
            siteName: 'Polvia',
            titlePhrase,
        });
    }

    it.each([
        ['pl', 1, 'Sklep — Etykieta, Poznań i 1 inne miasto | Polvia'],
        ['pl', 4, 'Sklep — Etykieta, Poznań i 4 inne miasta | Polvia'],
        ['pl', 5, 'Sklep — Etykieta, Poznań i 5 innych miast | Polvia'],
        ['en', 1, 'Sklep — Etykieta, Poznań and 1 other city | Polvia'],
        ['en', 4, 'Sklep — Etykieta, Poznań and 4 other cities | Polvia'],
        ['ru', 1, 'Sklep — Etykieta, Poznań и ещё 1 город | Polvia'],
        ['ru', 4, 'Sklep — Etykieta, Poznań и ещё 4 города | Polvia'],
        ['ru', 5, 'Sklep — Etykieta, Poznań и ещё 5 городов | Polvia'],
        ['uk', 1, 'Sklep — Etykieta, Poznań та ще 1 місто | Polvia'],
        ['uk', 4, 'Sklep — Etykieta, Poznań та ще 4 міста | Polvia'],
        ['uk', 5, 'Sklep — Etykieta, Poznań та ще 5 міст | Polvia'],
    ] as const)('%s, %i innych: odmiana liczby miast', (locale, otherCities, expected) => {
        expect(
            multiCityTitle({
                locale,
                name: 'Sklep',
                category: 'grocery',
                languages: ['pl'],
                otherCities,
            }),
        ).toBe(expected);
    });

    it('z fraza jezykowa, gdy sie miesci: fraza i miasta', () => {
        expect(
            multiCityTitle({
                locale: 'pl',
                name: 'Ola',
                category: 'health',
                languages: ['pl', 'uk'],
                otherCities: 2,
            }),
        ).toBe('Ola — ukraiński lekarz, Poznań i 2 inne miasta | Polvia');
    });

    it('za dlugo z miastami: tytul jak dla jednego miasta (zwykle reguly skracania)', () => {
        const result = multiCityTitle({
            locale: 'pl',
            name: 'Slowianoczka',
            category: 'grocery',
            languages: ['pl', 'uk', 'ru'],
            otherCities: 4,
        });

        expect(result.length).toBeLessThanOrEqual(PROFILE_TITLE_MAX_LENGTH);
        expect(result).toBe('Slowianoczka — ukraiński sklep spożywczy, Poznań | Polvia');
    });

    it('bez miast dodatkowych (null) tytul bez zmian', () => {
        expect(
            buildProfileTitle({
                name: 'Mistrz Remontu',
                categoryLabel: 'Remonty',
                city: 'Warszawa',
                cityWithOthers: null,
                siteName: 'Polvia',
            }),
        ).toBe('Mistrz Remontu — Remonty, Warszawa | Polvia');
    });
});
