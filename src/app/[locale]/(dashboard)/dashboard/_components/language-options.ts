import { SERVICE_LANGUAGES, type ServiceLanguage } from '@/lib/languages';

/**
 * Etykiety jezykow obslugi w dashboardzie (dashboard nie ma i18n — po angielsku).
 * `Record` wymusza etykiete dla kazdego kodu: nowy kod w `SERVICE_LANGUAGES` bez etykiety
 * to blad typecheckera, nie cicho brakujacy checkbox. Modul bez zoda i drizzle — importuja
 * go komponenty klienckie.
 */
const LANGUAGE_LABELS: Readonly<Record<ServiceLanguage, string>> = {
    pl: 'Polish',
    uk: 'Ukrainian',
    ru: 'Russian',
    en: 'English',
    be: 'Belarusian',
};

export type LanguageOption = { value: ServiceLanguage; label: string };

/** Opcje checkboxow w kolejnosci kanonicznej `SERVICE_LANGUAGES`. */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = SERVICE_LANGUAGES.map(value => ({
    value,
    label: LANGUAGE_LABELS[value],
}));
