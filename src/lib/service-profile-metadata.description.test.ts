import { createTranslator } from 'next-intl';

import type { Locale } from '@/i18n/config';
import type { Coverage } from '@/lib/coverage';
import type { ServiceLanguage } from '@/lib/languages';

import en from '../../messages/en.json';
import pl from '../../messages/pl.json';
import ru from '../../messages/ru.json';
import uk from '../../messages/uk.json';
import { selectFallbackDescriptionKey } from './service-profile-metadata';
import { buildLanguageMetaTexts } from './service-profile-languages';

/** Typ `pl` dla wszystkich locale: klucze tlumaczen musza byc identyczne. */
const MESSAGES: Record<Locale, typeof pl> = { pl, en, ru, uk };

type DescriptionCase = {
    locale: Locale;
    coverage: Coverage;
    city: string | null;
    languages: ServiceLanguage[];
};

/** Opis zastepczy jak w `generateMetadata`, z prawdziwych tlumaczen. */
function fallbackDescription({ locale, coverage, city, languages }: DescriptionCase): string {
    const t = createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'ServiceProfile.meta',
    });
    const texts = buildLanguageMetaTexts(t, locale, languages, 'Kategoria');
    return t(selectFallbackDescriptionKey(coverage, city, texts.hasDescribedLanguages), {
        name: 'Firma',
        category: 'Kategoria',
        city: city ?? '',
        ...texts.descriptionValues,
    });
}

describe('selectFallbackDescriptionKey z jezykami', () => {
    it('jezyki obslugi daja wariant …Languages tego samego klucza', () => {
        expect(selectFallbackDescriptionKey('local', 'Warszawa', true)).toBe(
            'descriptionLocalLanguages',
        );
        expect(selectFallbackDescriptionKey('online', null, true)).toBe(
            'descriptionOnlineLanguages',
        );
        expect(selectFallbackDescriptionKey('local', null, true)).toBe(
            'descriptionGenericLanguages',
        );
    });

    it('bez jezykow zostaje klucz podstawowy', () => {
        expect(selectFallbackDescriptionKey('local', 'Warszawa', false)).toBe('descriptionLocal');
    });
});

describe('opis zastepczy z jezykami obslugi', () => {
    it('pl: lista jezykow po polsku, bez polskiego', () => {
        expect(
            fallbackDescription({
                locale: 'pl',
                coverage: 'local',
                city: 'Warszawa',
                languages: ['pl', 'uk', 'ru'],
            }),
        ).toBe(
            'Firma — Kategoria, Warszawa. Obsługa po ukraińsku i rosyjsku. Adres, telefon, godziny otwarcia i kontakt w katalogu Polvia.',
        );
    });

    it('en: wpis online', () => {
        expect(
            fallbackDescription({
                locale: 'en',
                coverage: 'online',
                city: null,
                languages: ['uk', 'ru', 'en'],
            }),
        ).toContain('online service in Ukrainian, Russian, and English.');
    });

    it('ru: liczba pojedyncza i mnoga slowa „язык”', () => {
        const one = fallbackDescription({
            locale: 'ru',
            coverage: 'local',
            city: null,
            languages: ['pl', 'uk'],
        });
        const many = fallbackDescription({
            locale: 'ru',
            coverage: 'local',
            city: null,
            languages: ['uk', 'ru'],
        });

        expect(one).toContain('Обслуживание на украинском языке.');
        expect(many).toContain('Обслуживание на украинском и русском языках.');
    });

    it('uk: forma narzednika', () => {
        expect(
            fallbackDescription({
                locale: 'uk',
                coverage: 'local',
                city: 'Kraków',
                languages: ['uk', 'en'],
            }),
        ).toContain('Обслуговування українською і англійською.');
    });

    it('firma tylko po polsku: opis bez zdania o jezykach', () => {
        const description = fallbackDescription({
            locale: 'pl',
            coverage: 'local',
            city: 'Warszawa',
            languages: ['pl'],
        });

        expect(description).not.toContain('Obsługa po');
        expect(description).toBe(
            'Firma — Kategoria, Warszawa. Adres, telefon, godziny otwarcia i kontakt w katalogu Polvia.',
        );
    });
});
