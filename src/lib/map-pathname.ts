import { locales, type Locale } from '@/i18n/config';

/**
 * Rozbior sciezki URL mapy na locale i segmenty slugu.
 *
 * Wydzielone z `src/middleware.ts`, bo tamten modul importuje
 * `next-intl/middleware` (ESM), czego nie da sie zaimportowac w tescie
 * jednostkowym. Tutaj zostaje czysta, testowalna logika.
 */
export type MapPathname = {
    locale: Locale;
    slug: string[];
};

/**
 * Zwraca locale i segmenty slugu, albo `null` gdy sciezka nie jest mapa
 * ze slugiem.
 *
 * Obsluguje `/mapa/**` (locale `pl`, domyslny, bez prefiksu) oraz
 * `/{locale}/map/**`. Sama `/mapa` i `/{locale}/map` zwracaja `null` —
 * nie ma tam slugu do walidacji.
 */
export function parseMapPathname(pathname: string): MapPathname | null {
    const plMatch = /^\/mapa\/(.+)$/.exec(pathname);
    if (plMatch) {
        return { locale: 'pl', slug: plMatch[1].split('/') };
    }

    const prefixedMatch = /^\/([a-z]{2})\/map\/(.+)$/.exec(pathname);
    if (prefixedMatch && locales.includes(prefixedMatch[1] as Locale)) {
        return { locale: prefixedMatch[1] as Locale, slug: prefixedMatch[2].split('/') };
    }

    return null;
}
