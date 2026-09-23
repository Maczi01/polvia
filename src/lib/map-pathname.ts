import { type Locale, locales } from '@/i18n/config';
import { type MapFilters, parseMapSlug } from '@/lib/map-slug-parser';
import { localizedMapBasePath } from '@/lib/map-url-builder';

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

const NO_FILTERS: MapFilters = { category: null, county: null, city: null, onlineOnly: false };

/**
 * Odtwarza filtry mapy z adresu przegladarki (`window.location.pathname`).
 *
 * Potrzebne po `popstate`: filtry zmieniaja adres przez `history.pushState`,
 * wiec przy Wstecz/Naprzod serwer nie przysyla nowych `initialFilters` —
 * jedynym zrodlem prawdy jest sam adres.
 *
 * Sciezka spoza mapy danego locale albo z nieprawidlowym slugiem daje brak
 * filtrow — tak samo jak serwer, ktory takie adresy odrzuca.
 */
export function mapFiltersFromPathname(pathname: string, locale: Locale): MapFilters {
    const basePath = localizedMapBasePath(locale);
    if (pathname === basePath) return NO_FILTERS;
    if (!pathname.startsWith(`${basePath}/`)) return NO_FILTERS;

    const slug = pathname.slice(basePath.length + 1).split('/');
    const result = parseMapSlug(slug, locale, basePath);
    return result.success ? result.filters : NO_FILTERS;
}
