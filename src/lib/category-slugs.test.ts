import { locales, type Locale } from '@/i18n/config';
import {
    CATEGORY_KEYS,
    CATEGORY_MESSAGE_KEYS,
    CATEGORY_SLUGS,
    getCategoryFromSlug,
    getSlugFromCategory,
    isOnlineSlug,
} from '@/lib/slug-mappings';
import enMessages from '../../messages/en.json';
import plMessages from '../../messages/pl.json';
import ruMessages from '../../messages/ru.json';
import ukMessages from '../../messages/uk.json';

/**
 * Kategoria zyje w kilkunastu miejscach naraz (enum w bazie, `categories`
 * w consts, slugi per locale, klucze tlumaczen). Ten plik pilnuje warstwy
 * slugow: kazda kategoria musi miec slug w KAZDYM locale i wracac z powrotem
 * do swojego klucza — brak sluga w jednym locale to 404 widoczny tylko dla
 * czesci uzytkownikow, czyli dokladnie ten rodzaj bledu, ktorego nie widac
 * w normalnym klikaniu po `pl`.
 */
describe('CATEGORY_SLUGS — kompletnosc i round-trip', () => {
    it.each(locales)('locale %s ma slug dla kazdej kategorii', locale => {
        const slugs = CATEGORY_SLUGS[locale as Locale];

        for (const key of CATEGORY_KEYS) {
            expect(slugs[key]).toBeTruthy();
        }
    });

    it.each(locales)('locale %s: slug wraca do swojego klucza', locale => {
        for (const key of CATEGORY_KEYS) {
            const slug = getSlugFromCategory(key, locale as Locale);

            expect(slug).not.toBeNull();
            expect(getCategoryFromSlug(slug as string, locale as Locale)).toBe(key);
        }
    });

    it.each(locales)('locale %s nie ma dwoch kategorii o tym samym slugu', locale => {
        const slugs = Object.values(CATEGORY_SLUGS[locale as Locale]);

        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it.each(locales)('locale %s: zaden slug kategorii nie koliduje z zasiegiem online', locale => {
        for (const slug of Object.values(CATEGORY_SLUGS[locale as Locale])) {
            expect(isOnlineSlug(slug)).toBe(false);
        }
    });
});

describe('kategoria `it`', () => {
    it('jest znana warstwie slugow', () => {
        expect(CATEGORY_KEYS).toContain('it');
    });

    it.each(locales)('locale %s parsuje wlasny slug kategorii it', locale => {
        const slug = CATEGORY_SLUGS[locale as Locale].it;

        expect(getCategoryFromSlug(slug, locale as Locale)).toBe('it');
    });

    it('nie oddaje slugu z innego locale — asercja negatywna', () => {
        // Slug polski nie moze byc rozpoznawany na angielskiej wersji mapy,
        // bo wtedy dwa adresy prowadzilyby do tej samej strony (duplikat SEO).
        expect(getCategoryFromSlug(CATEGORY_SLUGS.pl.it, 'en')).toBeNull();
        expect(getCategoryFromSlug(CATEGORY_SLUGS.en.it, 'pl')).toBeNull();
    });
});

/**
 * Warstwa kluczy tlumaczen — druga po slugach. Tytul strony mapy budowany byl
 * przez kapitalizacje pierwszej litery (`help_support` -> `Help_support`), co
 * dziala tylko dla kategorii jednowyrazowych. Dla `help_support`, `real_estate`
 * i `it` klucz nie istnial i w `<title>` ladowal surowy `MapPage.Categories.*`,
 * widoczny dla Google. Ten blok sprawdza mape wobec PRAWDZIWYCH plikow
 * tlumaczen, a nie wobec wlasnych zalozen.
 */
describe('CATEGORY_MESSAGE_KEYS — kompletnosc wobec plikow messages', () => {
    const MESSAGES: Record<string, Record<string, string>> = {
        pl: plMessages.MapPage.Categories,
        en: enMessages.MapPage.Categories,
        ru: ruMessages.MapPage.Categories,
        uk: ukMessages.MapPage.Categories,
    };

    it('ma klucz dla kazdej kategorii', () => {
        for (const key of CATEGORY_KEYS) {
            expect(CATEGORY_MESSAGE_KEYS[key]).toBeTruthy();
        }
    });

    it.each(locales)('locale %s tlumaczy kazdy klucz kategorii', locale => {
        const categories = MESSAGES[locale];

        for (const key of CATEGORY_KEYS) {
            const messageKey = CATEGORY_MESSAGE_KEYS[key];

            expect(categories[messageKey]).toBeTruthy();
        }
    });

    // Asercja negatywna: nazwa kategorii nie moze przeciekac do tytulu jako
    // surowy klucz. Gdyby ktos wrocil do kapitalizacji, te trzy wysypia sie tu.
    it.each(['help_support', 'real_estate', 'it'] as const)(
        'kategoria %s ma klucz inny niz naiwna kapitalizacja',
        key => {
            const naive = key.charAt(0).toUpperCase() + key.slice(1);

            expect(CATEGORY_MESSAGE_KEYS[key]).not.toBe(naive);
            expect(MESSAGES.pl[naive]).toBeUndefined();
        },
    );
});
