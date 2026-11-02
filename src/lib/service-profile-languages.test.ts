import { createTranslator } from 'next-intl';

import { type Locale, locales } from '@/i18n/config';
import { CATEGORY_VALUES } from '@/lib/categories';
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
    type TitleLanguage,
} from './service-profile-languages';

/** Typ `pl` dla wszystkich locale: klucze tlumaczen musza byc identyczne. */
const MESSAGES: Record<Locale, typeof pl> = { pl, en, ru, uk };

const TITLE_LANGUAGES: readonly TitleLanguage[] = ['uk', 'ru', 'be'];

function metaTexts(locale: Locale, languages: ServiceLanguage[], category: string) {
    const t = createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'ServiceProfile.meta',
    });
    return buildLanguageMetaTexts(t, locale, languages, category);
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
        for (const locale of locales) {
            expect(selectTitleLanguage(locale, ['pl', 'en'])).toBeNull();
        }
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

describe('titlePhrase: komplet tlumaczen', () => {
    it.each(locales)('%s: kazda kategoria x jezyk frazy ma niepusta fraze', locale => {
        const phrases = MESSAGES[locale].ServiceProfile.meta.titlePhrase;

        for (const language of TITLE_LANGUAGES) {
            expect(Object.keys(phrases[language]).sort()).toEqual([...CATEGORY_VALUES].sort());
            for (const category of CATEGORY_VALUES) {
                expect(phrases[language][category].trim()).not.toBe('');
            }
        }
    });

    it('frazy jezyka ru mowia o jezyku obslugi, nie o rosyjskiej firmie', () => {
        const nationality: Record<Locale, RegExp> = {
            pl: /(^|\s)rosyjsk(i|a|ie)(\s|$)/,
            uk: /(^|\s)російськ(ий|а|е|і)(\s|$)/,
            ru: /(^|\s)русск(ий|ая|ое|ие)(\s|$)/,
            en: /(^|\s)Russian\s/,
        };

        for (const locale of locales) {
            const phrases = Object.values(MESSAGES[locale].ServiceProfile.meta.titlePhrase.ru);
            for (const phrase of phrases) {
                expect(phrase).not.toMatch(nationality[locale]);
            }
        }
    });
});

describe('buildLanguageMetaTexts', () => {
    it.each([
        ['pl', 'ukraiński sklep spożywczy'],
        ['en', 'Ukrainian grocery store'],
        ['uk', 'український продуктовий магазин'],
        ['ru', 'русскоязычный продуктовый магазин'],
    ] as const)('%s: fraza w jezyku wybranym dla locale', (locale, expected) => {
        expect(metaTexts(locale, ['pl', 'uk', 'ru'], 'grocery').titlePhrase).toBe(expected);
    });

    it('nieznana kategoria z bazy dostaje fraze "others"', () => {
        expect(metaTexts('pl', ['uk'], 'unknown').titlePhrase).toBe('ukraińska firma');
    });

    it('firma bez jezyka frazy: brak frazy i brak listy jezykow', () => {
        const texts = metaTexts('pl', ['pl'], 'renovation');

        expect(texts.titlePhrase).toBeNull();
        expect(texts.hasDescribedLanguages).toBe(false);
    });

    it('lista jezykow do opisu w formie gramatycznej locale', () => {
        expect(metaTexts('pl', ['pl', 'uk', 'ru'], 'renovation').descriptionValues).toEqual({
            languages: 'ukraińsku i rosyjsku',
            languageCount: 2,
        });
        expect(metaTexts('uk', ['uk', 'en'], 'renovation').descriptionValues.languages).toBe(
            'українською і англійською',
        );
    });
});
