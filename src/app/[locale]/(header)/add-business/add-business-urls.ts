import type { Metadata } from 'next';

import { defaultLocale, type Locale, locales } from '@/i18n/config';
import { getPathname } from '@/i18n/navigation';

/**
 * Adresy strony „Dodaj firme" (D13) z routingu next-intl: `pl` → `/dodaj-firme`
 * (bez prefiksu), pozostale → `/{locale}/add-business`. Prefiksu nie wpisujemy recznie
 * (learned-patterns: `'/en'` na sztywno przelacza jezyk na `ru`/`uk`).
 */
export function addBusinessUrl(baseUrl: string, locale: Locale): string {
    return `${baseUrl}${getPathname({ href: '/add-business', locale })}`;
}

export function addBusinessAlternates(
    baseUrl: string,
    locale: Locale,
): NonNullable<Metadata['alternates']> {
    return {
        canonical: addBusinessUrl(baseUrl, locale),
        languages: {
            'x-default': addBusinessUrl(baseUrl, defaultLocale),
            ...Object.fromEntries(locales.map(code => [code, addBusinessUrl(baseUrl, code)])),
        },
    };
}
