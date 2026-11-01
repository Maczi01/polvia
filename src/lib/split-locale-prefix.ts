import { defaultLocale, type Locale, locales } from '@/i18n/config';

/**
 * Sciezka URL rozbita na locale i segmenty po prefiksie — wspolny poczatek parserow
 * middleware (`map-pathname.ts`, `service-profile-path.ts`).
 */
export type LocaleSplitPathname = {
    /** Locale z prefiksu albo `pl` (domyslny, bez prefiksu). */
    locale: Locale;
    /** Czy sciezka zaczynala sie od segmentu locale (takze `/pl/...`). */
    isPrefixed: boolean;
    /** Segmenty po prefiksie locale, bez wiodacego `/` (`/en/map/x` → `['map', 'x']`). */
    segments: string[];
};

const LOCALE_SET: ReadonlySet<string> = new Set(locales);

function isLocale(value: string): value is Locale {
    return LOCALE_SET.has(value);
}

/**
 * Odcina prefiks locale ze sciezki. Pierwszy segment spoza listy locale oznacza
 * `pl` bez prefiksu — wtedy wszystkie segmenty zostaja.
 */
export function splitLocalePrefix(pathname: string): LocaleSplitPathname {
    const segments = pathname.split('/').slice(1);
    const [first, ...rest] = segments;

    if (first !== undefined && isLocale(first)) {
        return { locale: first, isPrefixed: true, segments: rest };
    }

    return { locale: defaultLocale, isPrefixed: false, segments };
}
