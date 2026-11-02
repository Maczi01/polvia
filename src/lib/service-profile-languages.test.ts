import { createTranslator } from 'next-intl';

import type { Locale } from '@/i18n/config';
import type { ServiceLanguage } from '@/lib/languages';

import en from '../../messages/en.json';
import pl from '../../messages/pl.json';
import ru from '../../messages/ru.json';
import uk from '../../messages/uk.json';
import {
    buildLanguageMetaTexts,
    formatLanguageList,
    selectDescribedLanguages,
    selectTitleLanguage,
    toTitleCategory,
} from './service-profile-languages';

/** Typ `pl` dla wszystkich locale: klucze tlumaczen musza byc identyczne. */
const MESSAGES: Record<Locale, typeof pl> = { pl, en, ru, uk };

function metaTexts(locale: Locale, languages: ServiceLanguage[], categoryLabel: string) {
    const t = createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'ServiceProfile.meta',
    });
    return buildLanguageMetaTexts(t, locale, languages, categoryLabel);
}

describe('selectTitleLanguage', () => {
    it('pl i en: pierwszy z uk, ru, be', () => {
        expect(selectTitleLanguage('pl', ['pl', 'ru', 'uk'])).toBe('uk');
        expect(selectTitleLanguage('en', ['pl', 'ru'])).toBe('ru');
        expect(selectTitleLanguage('pl', ['pl', 'en', 'be'])).toBe('be');
    });

    it('ru: najpierw rosyjski, potem ukrainski', () => {
        expect(selectTitleLanguage('ru', ['pl', 'uk', 'ru'])).toBe('ru');
        expect(selectTitleLanguage('ru', ['pl', 'uk'])).toBe('uk');
    });

    it('uk: tylko ukrainski', () => {
        expect(selectTitleLanguage('uk', ['pl', 'uk', 'ru'])).toBe('uk');
        expect(selectTitleLanguage('uk', ['pl', 'ru', 'be'])).toBeNull();
    });

    it('firma tylko po polsku (i angielsku) nie ma frazy w zadnym locale', () => {
        for (const locale of ['pl', 'en', 'ru', 'uk'] as const) {
            expect(selectTitleLanguage(locale, ['pl', 'en'])).toBeNull();
        }
    });
});

describe('toTitleCategory', () => {
    it('pl, uk, ru: pierwsza litera mala', () => {
        expect(toTitleCategory('Gastronomia', 'pl')).toBe('gastronomia');
        expect(toTitleCategory("Здоров'я", 'uk')).toBe("здоров'я");
        expect(toTitleCategory('Красота', 'ru')).toBe('красота');
    });

    it('en zostawia etykiete bez zmian', () => {
        expect(toTitleCategory('Real Estate', 'en')).toBe('Real Estate');
    });

    it('skrotowiec na poczatku zostaje wielka litera', () => {
        expect(toTitleCategory('IT i komputery', 'pl')).toBe('IT i komputery');
    });
});

describe('selectDescribedLanguages', () => {
    it('bez polskiego, w stalej kolejnosci jezykow obslugi', () => {
        expect(selectDescribedLanguages(['en', 'pl', 'ru', 'uk'])).toEqual(['uk', 'ru', 'en']);
    });

    it('sam polski daje pusta liste', () => {
        expect(selectDescribedLanguages(['pl'])).toEqual([]);
    });
});

describe('formatLanguageList', () => {
    it('laczy spojnikiem locale', () => {
        expect(formatLanguageList(['ukraińsku', 'rosyjsku'], 'pl')).toBe('ukraińsku i rosyjsku');
        expect(formatLanguageList(['Ukrainian', 'Russian', 'English'], 'en')).toBe(
            'Ukrainian, Russian, and English',
        );
    });
});

describe('buildLanguageMetaTexts', () => {
    it.each([
        ['pl', 'Gastronomia', 'gastronomia po ukraińsku'],
        ['en', 'Gastronomy', 'Gastronomy in Ukrainian'],
        ['uk', 'Гастрономія', 'гастрономія українською'],
        ['ru', 'Гастрономия', 'гастрономия на русском'],
    ] as const)('%s: kategoria z fraza jezykowa', (locale, label, expected) => {
        expect(metaTexts(locale, ['pl', 'uk', 'ru'], label).categoryWithLanguage).toBe(expected);
    });

    it('firma bez jezyka frazy: brak frazy i brak listy jezykow', () => {
        const texts = metaTexts('pl', ['pl'], 'Remonty');

        expect(texts.categoryWithLanguage).toBeNull();
        expect(texts.hasDescribedLanguages).toBe(false);
    });

    it('lista jezykow do opisu w formie gramatycznej locale', () => {
        expect(metaTexts('pl', ['pl', 'uk', 'ru'], 'Remonty').descriptionValues).toEqual({
            languages: 'ukraińsku i rosyjsku',
            languageCount: 2,
        });
        expect(metaTexts('uk', ['uk', 'en'], 'Ремонт').descriptionValues.languages).toBe(
            'українською і англійською',
        );
    });
});
