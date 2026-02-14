export const locales = ['pl', 'en'] as const; // Put default locale first
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pl';
export const localePrefix = 'as-needed' as const; // Change this!