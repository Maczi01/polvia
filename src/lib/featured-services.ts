export type FeaturedCandidate = {
    serviceId: string;
    name: string;
    category: string;
    city: string | null;
};

export type FeaturedService = FeaturedCandidate & { reason: 'popular' | 'new' };

const POPULAR_SLOTS = 2;

/**
 * Wyroznione firmy na landing page: dwie najpopularniejsze i najnowsza,
 * ktora nie jest juz jedna z nich. Brak kandydatow w jednej liscie nie
 * blokuje drugiej.
 */
export function pickFeaturedServices(
    popular: FeaturedCandidate[],
    newest: FeaturedCandidate[],
): FeaturedService[] {
    const picked: FeaturedService[] = popular
        .slice(0, POPULAR_SLOTS)
        .map(service => ({ ...service, reason: 'popular' }));

    const pickedIds = new Set(picked.map(service => service.serviceId));
    const newcomer = newest.find(service => !pickedIds.has(service.serviceId));
    if (!newcomer) return picked;

    return [...picked, { ...newcomer, reason: 'new' }];
}
