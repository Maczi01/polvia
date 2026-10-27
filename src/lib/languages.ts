/**
 * Jezyki obslugi klienta — jedno zrodlo prawdy dla formularza „Dodaj firme", dashboardu,
 * kart uslug i filtra mapy.
 *
 * Jezyk obslugi to NIE locale strony: `be` jest jezykiem obslugi, ale nie ma wersji
 * jezykowej katalogu (locale treści: `@/i18n/config`). Modul bez importow runtime'owych,
 * zeby komponenty klienckie nie wciagaly zoda ani drizzle.
 */
export const SERVICE_LANGUAGES = ['pl', 'uk', 'ru', 'en', 'be'] as const;

export type ServiceLanguage = (typeof SERVICE_LANGUAGES)[number];

const SERVICE_LANGUAGE_SET: ReadonlySet<string> = new Set(SERVICE_LANGUAGES);

export function isServiceLanguage(value: string): value is ServiceLanguage {
    return SERVICE_LANGUAGE_SET.has(value);
}

/**
 * Kody z bazy (kolumna `text[]`) do wyswietlenia: bez duplikatow i bez kodow spoza listy
 * (stare wpisy moga miec np. `de`). Kolejnosc pierwszego wystapienia.
 */
export function toServiceLanguages(codes: readonly string[]): ServiceLanguage[] {
    return [...new Set(codes)].filter(isServiceLanguage);
}

/** Flaga per jezyk (pliki w `public/icons/`, kod kraju, nie jezyka). */
export const LANGUAGE_FLAG_PATHS: Readonly<Record<ServiceLanguage, string>> = {
    pl: '/icons/pl.svg',
    uk: '/icons/ua.svg',
    ru: '/icons/ru.svg',
    en: '/icons/gb.svg',
    be: '/icons/by.svg',
};

/** Nazwa jezyka w nim samym — stala, nie tlumaczona z locale strony. */
export const LANGUAGE_ENDONYMS: Readonly<Record<ServiceLanguage, string>> = {
    pl: 'Polski',
    uk: 'Українська',
    ru: 'Русский',
    en: 'English',
    be: 'Беларуская',
};
