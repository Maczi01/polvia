/** Ile pozycji pokazuje sekcja „Podobne firmy” na darmowym profilu. */
export const SIMILAR_SERVICES_LIMIT = 6;

export type SimilarService = {
    serviceId: string;
    /** Slug uslugi — adres `/firma/<slug>`. */
    slug: string;
    /** Nazwa w danym locale (fallback: nazwa bazowa). */
    name: string;
    image: string | null;
    /** Miasto glownej lokalizacji (albo pierwszej, gdy zadna nie jest glowna). */
    city: string | null;
    category: string;
};

export type SimilarServicesSource = {
    serviceId: string;
    category: string;
    city: string | null;
};

function normalizeCity(city: string | null): string {
    return (city ?? '').trim().toLocaleLowerCase('pl');
}

/**
 * „Podobne firmy”: ta sama kategoria, bez samego wpisu, najpierw to samo miasto
 * co glowna lokalizacja zrodla, potem reszta — w kazdej grupie alfabetycznie.
 * Celowo bez rankingu premium: kolejnosc ma byc prosta i przewidywalna.
 *
 * Kandydaci przychodza juz przefiltrowani w SQL; filtr kategorii i wlasnego
 * wpisu powtarzamy tu, bo to on definiuje sekcje, a nie ksztalt zapytania.
 */
export function pickSimilarServices(
    source: SimilarServicesSource,
    candidates: readonly SimilarService[],
): SimilarService[] {
    const sourceCity = normalizeCity(source.city);
    const isSameCity = (service: SimilarService): boolean =>
        sourceCity !== '' && normalizeCity(service.city) === sourceCity;

    return candidates
        .filter(
            service =>
                service.serviceId !== source.serviceId && service.category === source.category,
        )
        .toSorted(
            (a, b) =>
                Number(isSameCity(b)) - Number(isSameCity(a)) ||
                a.name.localeCompare(b.name, 'pl') ||
                a.serviceId.localeCompare(b.serviceId),
        )
        .slice(0, SIMILAR_SERVICES_LIMIT);
}
