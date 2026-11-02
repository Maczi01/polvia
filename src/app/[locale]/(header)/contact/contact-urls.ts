import type { Metadata } from 'next';

import { defaultLocale, type Locale, locales } from '@/i18n/config';
import { getPathname } from '@/i18n/navigation';

/**
 * Adresy strony kontaktu z routingu next-intl: `pl` → `/kontakt` (bez prefiksu), pozostale →
 * `/{locale}/contact`. Prefiksu nie wpisujemy recznie (learned-patterns: warunek na `'en'`
 * dawal `ru`/`uk` adres polskiej strony).
 */
export function contactUrl(baseUrl: string, locale: Locale): string {
    return `${baseUrl}${getPathname({ href: '/contact', locale })}`;
}

export function contactAlternates(
    baseUrl: string,
    locale: Locale,
): NonNullable<Metadata['alternates']> {
    return {
        canonical: contactUrl(baseUrl, locale),
        languages: {
            'x-default': contactUrl(baseUrl, defaultLocale),
            ...Object.fromEntries(locales.map(code => [code, contactUrl(baseUrl, code)])),
        },
    };
}
