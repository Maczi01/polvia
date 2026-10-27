import {
    isServiceLanguage,
    LANGUAGE_ENDONYMS,
    LANGUAGE_FLAG_PATHS,
    SERVICE_LANGUAGES,
    toServiceLanguages,
} from '@/lib/languages';

describe('SERVICE_LANGUAGES', () => {
    it('wymienia jezyki obslugi w kolejnosci pl, uk, ru, en, be', () => {
        expect(SERVICE_LANGUAGES).toEqual(['pl', 'uk', 'ru', 'en', 'be']);
    });
});

describe('isServiceLanguage', () => {
    it.each(['pl', 'uk', 'ru', 'en', 'be'])('akceptuje %s', code => {
        expect(isServiceLanguage(code)).toBe(true);
    });

    it.each(['de', '', 'PL', 'by'])('odrzuca %p', code => {
        expect(isServiceLanguage(code)).toBe(false);
    });
});

describe('LANGUAGE_FLAG_PATHS', () => {
    it.each(SERVICE_LANGUAGES)('%s ma sciezke flagi w /icons/', code => {
        expect(LANGUAGE_FLAG_PATHS[code]).toMatch(/^\/icons\/[a-z]{2}\.svg$/);
    });

    it('bialoruski uzywa flagi by.svg', () => {
        expect(LANGUAGE_FLAG_PATHS.be).toBe('/icons/by.svg');
    });
});

describe('LANGUAGE_ENDONYMS', () => {
    it.each(SERVICE_LANGUAGES)('%s ma niepusty endonim', code => {
        expect(LANGUAGE_ENDONYMS[code].trim()).not.toBe('');
    });

    it('endonimy sa nazwami jezykow w nich samych', () => {
        expect(LANGUAGE_ENDONYMS).toEqual({
            pl: 'Polski',
            uk: 'Українська',
            ru: 'Русский',
            en: 'English',
            be: 'Беларуская',
        });
    });
});

describe('toServiceLanguages', () => {
    it('usuwa duplikaty, zachowujac kolejnosc pierwszego wystapienia', () => {
        expect(toServiceLanguages(['be', 'pl', 'be'])).toEqual(['be', 'pl']);
    });

    it('pomija kody spoza listy jezykow obslugi', () => {
        expect(toServiceLanguages(['pl', 'de', 'by'])).toEqual(['pl']);
    });

    it('pusta lista daje pusta liste', () => {
        expect(toServiceLanguages([])).toEqual([]);
    });
});
