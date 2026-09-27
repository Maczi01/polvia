import { foldForSearch } from '@/lib/search-text';

type SearchableService = {
    name: string;
    slug?: string | null;
    category?: string | null;
    city?: string | null;
    nip?: string | null;
};

/**
 * Filtr tabeli uslug w dashboardzie: nazwa, slug, kategoria i miasto bez polskich
 * znakow po obu stronach ("lodz" trafia "Łódź"); NIP porownywany doslownie.
 */
export function filterDashboardServices<T extends SearchableService>(
    services: T[],
    search: string,
): T[] {
    const query = foldForSearch(search.trim());
    if (!query) return services;

    return services.filter(
        service =>
            [service.name, service.slug, service.category, service.city].some(
                field => field != null && foldForSearch(field).includes(query),
            ) ||
            (service.nip?.includes(search.trim()) ?? false),
    );
}
