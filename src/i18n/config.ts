export const locales = ['pl', 'en', 'ru', 'uk'] as const; // Put default locale first
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pl';
export const localePrefix = 'as-needed' as const; // Change this!

const LOCALE_SET: ReadonlySet<string> = new Set(locales);

function isLocale(value: string | null | undefined): value is Locale {
    return typeof value === 'string' && LOCALE_SET.has(value);
}

/**
 * Locale z niezaufanego tekstu (parametr trasy, `getLocale()`, `useLocale()`), a dla wartosci
 * spoza listy — `defaultLocale`. Bez zaleznosci od next-intl: modul czytaja tez komponenty
 * klienckie i testy, ktore mockuja `next-intl`.
 */
export function toLocale(value: string | null | undefined): Locale {
    return isLocale(value) ? value : defaultLocale;
}
