import type { CoverageFilters } from '@/lib/service-coverage';

/**
 * Klucz deduplikacji zapytan semantycznych na ekranie mapy.
 *
 * Musi zawierac KAZDA os, ktora zmienia liste lokalna: jej dlugosc decyduje o odpaleniu
 * zapytania, a jej identyfikatory ida jako `excludeIds`. Os pominieta w kluczu czysci
 * wyniki semantyczne (efekt reaguje na nowa dlugosc listy), ale nie pobiera ich ponownie,
 * bo klucz sie nie zmienil — tak znikaly po zmianie jezyka i miasta.
 */
export function semanticSearchKey(filters: CoverageFilters): string {
    return JSON.stringify([
        filters.query ?? '',
        filters.category ?? '',
        filters.county ?? '',
        filters.city ?? '',
        filters.onlineOnly ?? false,
        filters.language ?? null,
    ]);
}
