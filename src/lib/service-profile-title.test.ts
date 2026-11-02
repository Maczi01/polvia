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
    categoryLabel: string;
    city: string | null;
    languages: ServiceLanguage[];
};

/** Tytul jak w `generateMetadata`: fraza z prawdziwych tlumaczen danego locale. */
function title({ locale, name, categoryLabel, city, languages }: TitleCase): string {
    const t = createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'ServiceProfile.meta',
    });
    const { categoryWithLanguage } = buildLanguageMetaTexts(t, locale, languages, categoryLabel);
    return buildProfileTitle({
        name,
        categoryLabel,
        city,
        siteName: 'Polvia',
        categoryWithLanguage,
    });
}

describe('buildProfileTitle z jezykiem obslugi', () => {
    it.each([
        ['pl', 'Gastronomia', 'Multi Cook — gastronomia po ukraińsku, Warszawa | Polvia'],
        ['en', 'Gastronomy', 'Multi Cook — Gastronomy in Ukrainian, Warszawa | Polvia'],
        ['uk', 'Гастрономія', 'Multi Cook — гастрономія українською, Warszawa | Polvia'],
        ['ru', 'Гастрономия', 'Multi Cook — гастрономия на русском, Warszawa | Polvia'],
    ] as const)('%s: fraza w jezyku locale', (locale, categoryLabel, expected) => {
        expect(
            title({
                locale,
                name: 'Multi Cook',
                categoryLabel,
                city: 'Warszawa',
                languages: ['pl', 'uk', 'ru'],
            }),
        ).toBe(expected);
    });

    it('ru bez rosyjskiego: fraza o ukrainskim', () => {
        expect(
            title({
                locale: 'ru',
                name: 'Twój Lekarz',
                categoryLabel: 'Здоровье',
                city: 'Warszawa',
                languages: ['pl', 'uk'],
            }),
        ).toBe('Twój Lekarz — здоровье на украинском, Warszawa | Polvia');
    });

    it('bez jezykow wschodnioslowianskich: tytul bez frazy, kategoria bez zmian', () => {
        expect(
            title({
                locale: 'pl',
                name: 'Mistrz Remontu',
                categoryLabel: 'Remonty',
                city: 'Warszawa',
                languages: ['pl', 'en'],
            }),
        ).toBe('Mistrz Remontu — Remonty, Warszawa | Polvia');
    });

    it('firma tylko pl: tytul bez frazy w kazdym locale', () => {
        for (const locale of ['pl', 'en', 'ru', 'uk'] as const) {
            expect(
                title({
                    locale,
                    name: 'Taxovia',
                    categoryLabel: 'X',
                    city: null,
                    languages: ['pl'],
                }),
            ).toBe('Taxovia — X | Polvia');
        }
    });

    it('skrotowiec w kategorii zostaje wielka litera', () => {
        expect(
            title({
                locale: 'pl',
                name: 'Serwis',
                categoryLabel: 'IT i komputery',
                city: null,
                languages: ['uk'],
            }),
        ).toBe('Serwis — IT i komputery po ukraińsku | Polvia');
    });

    it('dluga nazwa: skraca sie nazwa (nie ponizej minimum), fraza, miasto i sufiks zostaja', () => {
        const result = title({
            locale: 'pl',
            name: 'Kancelaria Adwokacka Nowak i Wspólnicy',
            categoryLabel: 'Prawne',
            city: 'Łódź',
            languages: ['pl', 'uk'],
        });

        expect(result.length).toBeLessThanOrEqual(PROFILE_TITLE_MAX_LENGTH);
        expect(result).toBe('Kancelaria Adwokacka… — prawne po ukraińsku, Łódź | Polvia');
    });

    it('nazwa zmiescilaby sie tylko ponizej minimum: znika miasto, fraza zostaje', () => {
        const result = title({
            locale: 'pl',
            name: 'Lviv Croissants',
            categoryLabel: 'Gastronomia',
            city: 'Warszawa',
            languages: ['pl', 'uk'],
        });

        expect(result).toBe('Lviv Croissants — gastronomia po ukraińsku | Polvia');
    });

    it('bardzo dluga nazwa bez miejsca na miasto: nazwa skrocona, fraza i sufiks zostaja', () => {
        const result = title({
            locale: 'pl',
            name: 'Kancelaria Adwokacka Adwokat Jan Kowalski i Wspolnicy',
            categoryLabel: 'Prawne',
            city: 'Warszawa',
            languages: ['pl', 'uk'],
        });

        expect(result.length).toBeLessThanOrEqual(PROFILE_TITLE_MAX_LENGTH);
        expect(result).toBe('Kancelaria Adwokacka… — prawne po ukraińsku | Polvia');
    });

    it('fraza zbyt dluga na nazwe: nazwa nie krotsza niz minimum, koniec obciety', () => {
        const result = buildProfileTitle({
            name: 'Centrum Medyczne Zdrowa Rodzina',
            categoryLabel: 'Pomoc i wsparcie',
            categoryWithLanguage: 'pomoc i wsparcie po białorusku i jeszcze dluzej',
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
