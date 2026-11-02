import type { Locale } from '@/i18n/config';
import { type Category, isCategory } from '@/lib/categories';
import { SERVICE_LANGUAGES, type ServiceLanguage } from '@/lib/languages';

/**
 * Jezyk obslugi w SEO profilu firmy: fraza w tytule i lista jezykow w opisie zastepczym.
 * Czyste funkcje — slowa w danym locale daja tlumaczenia `ServiceProfile.meta`.
 */

/** Jezyki, ktore moga trafic do tytulu — rdzen intencji („ukraiński lekarz Warszawa”). */
export type TitleLanguage = Extract<ServiceLanguage, 'uk' | 'ru' | 'be'>;

/**
 * Kolejnosc wyboru jezyka do tytulu per locale strony. `pl` i `en` czyta ktos, kto szuka
 * obslugi w swoim jezyku po polsku/angielsku („lekarz po ukrainsku”) — pierwszy z uk, ru, be.
 * `uk` i `ru` czyta ktos, kto szuka juz w swoim jezyku, wiec najpierw jezyk locale.
 * Na `ru` dalej uk i be (rosyjskojezyczni Ukraincy i Bialorusini); na `uk` tylko ukrainski —
 * „російською” w ukrainskim tytule nie odpowiada intencji i jest drazliwe.
 */
const TITLE_LANGUAGE_PRIORITY = {
    pl: ['uk', 'ru', 'be'],
    en: ['uk', 'ru', 'be'],
    ru: ['ru', 'uk', 'be'],
    uk: ['uk'],
} as const satisfies Record<Locale, readonly TitleLanguage[]>;

/** Jezyk frazy w tytule albo `null`, gdy firma nie obsluguje zadnego z jezykow danego locale. */
export function selectTitleLanguage(
    locale: Locale,
    languages: readonly ServiceLanguage[],
): TitleLanguage | null {
    const priority: readonly TitleLanguage[] = TITLE_LANGUAGE_PRIORITY[locale];
    return priority.find(language => languages.includes(language)) ?? null;
}

/** Jezyk obslugi wymieniany w opisie — polski jest w katalogu firm w Polsce oczywisty. */
export type DescribedLanguage = Exclude<ServiceLanguage, 'pl'>;

function isDescribedLanguage(language: ServiceLanguage): language is DescribedLanguage {
    return language !== 'pl';
}

/** Jezyki obslugi poza polskim, w stalej kolejnosci `SERVICE_LANGUAGES` (bez duplikatow). */
export function selectDescribedLanguages(
    languages: readonly ServiceLanguage[],
): DescribedLanguage[] {
    return SERVICE_LANGUAGES.filter(isDescribedLanguage).filter(language =>
        languages.includes(language),
    );
}

/** „ukraińsku i rosyjsku”, „Ukrainian, Russian, and English” — spojnik wg locale. */
export function formatLanguageList(words: readonly string[], locale: Locale): string {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(words);
}

/**
 * Tlumaczenie z namespace `ServiceProfile.meta` — `t` z `getTranslations` albo
 * `createTranslator` (testy).
 */
export type MetaTranslate = (
    key: `titlePhrase.${TitleLanguage}.${Category}` | `languageNames.${DescribedLanguage}`,
    values?: Record<string, string | number>,
) => string;

export type LanguageMetaTexts = {
    /**
     * Fraza do tytulu: przymiotnik jezyka/narodowosci uzgodniony z rzeczownikiem kategorii
     * („ukraiński sklep spożywczy”), albo `null` (brak jezyka frazy w danym locale).
     */
    titlePhrase: string | null;
    /** Parametry wariantu `…Languages` opisu zastepczego. */
    descriptionValues: { languages: string; languageCount: number };
    hasDescribedLanguages: boolean;
};

/**
 * Teksty o jezyku obslugi do tytulu i opisu zastepczego profilu w danym locale.
 * Fraza tytulu to gotowy tekst per jezyk i kategoria (`titlePhrase.<jezyk>.<kategoria>`):
 * rodzaj i liczba przymiotnika zaleza od rzeczownika, wiec nie da sie ich skleic z etykiety.
 * Nieznana kategoria z bazy dostaje fraze `others`.
 */
export function buildLanguageMetaTexts(
    t: MetaTranslate,
    locale: Locale,
    languages: readonly ServiceLanguage[],
    category: string,
): LanguageMetaTexts {
    const categoryKey: Category = isCategory(category) ? category : 'others';
    const titleLanguage = selectTitleLanguage(locale, languages);
    const described = selectDescribedLanguages(languages);

    return {
        titlePhrase: titleLanguage ? t(`titlePhrase.${titleLanguage}.${categoryKey}`) : null,
        descriptionValues: {
            languages: formatLanguageList(
                described.map(language => t(`languageNames.${language}`)),
                locale,
            ),
            languageCount: described.length,
        },
        hasDescribedLanguages: described.length > 0,
    };
}
