import type { CoverageFilters } from '@/lib/service-coverage';

/**
 * Klucz deduplikacji zapytan semantycznych na ekranie mapy.
 *
 * Musi zawierac KAZDA os, ktora zmienia liste lokalna: jej dlugosc decyduje o odpaleniu
 * zapytania, a jej identyfikatory ida jako `excludeIds`. Os pominieta w kluczu czysci
 * wyniki semantyczne (efekt reaguje na nowa dlugosc listy), ale nie pobiera ich ponownie,
 * bo klucz sie nie zmienil — tak znikaly po zmianie jezyka i miasta.
 *
 * Kompletnosc pilnuje kompilator: `satisfies Record<keyof CoverageFilters, …>` zglasza
 * zarowno os dodana do `CoverageFilters` i brakujaca tutaj, jak i pole nadmiarowe.
 * Kolejnosc serializacji to kolejnosc pol w literale — stala, wiec klucz jest stabilny.
 */
export function semanticSearchKey(filters: CoverageFilters): string {
    const axes = {
        query: filters.query ?? '',
        category: filters.category ?? '',
        county: filters.county ?? '',
        city: filters.city ?? '',
        onlineOnly: filters.onlineOnly ?? false,
        language: filters.language ?? null,
    } satisfies Record<keyof CoverageFilters, unknown>;

    return JSON.stringify(axes);
}
