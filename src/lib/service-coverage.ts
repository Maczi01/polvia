import type { PartialService } from '@/types';

/**
 * Kubelkowanie wynikow po zasiegu obslugi (R4, R5, R6).
 *
 * Czysta funkcja, celowo POZA komponentem: `services-client-component.tsx` ma
 * ponad 300 linii z `coding-rules.md`, a te reguly sa dokladnie tym rodzajem
 * logiki, ktory musi miec testy jednostkowe.
 *
 * NIE dodawac tu `import 'server-only'` — funkcje wola Client Component.
 * NIE dodawac tu sortowania — `getServices` sortuje juz po `priority` i `clicks`,
 * a kubelkowanie tylko filtruje, zachowujac kolejnosc wejsciowa.
 */

export type CoverageFilters = {
    query?: string | null;
    category?: string | null;
    county?: string | null;
    city?: string | null;
    /** Zawezenie do samych uslug zdalnych — oproznia liste lokalna. */
    onlineOnly?: boolean | null;
};

export type CoverageBuckets = {
    /** Wpisy, ktore mozna odwiedzic i ktore przechodza filtr geograficzny. */
    localResults: PartialService[];
    /** Wpisy dostepne zdalnie, ktorych NIE ma juz na innej liscie tego ekranu. */
    onlineResults: PartialService[];
};

/** Semantyka przeniesiona 1:1 z poprzedniego `frontendFilteredServices`. */
function matchesQuery(item: PartialService, query: string): boolean {
    if (!query) return true;
    return (
        item.name.toLowerCase().includes(query) ||
        (item.description?.toLowerCase().includes(query) ?? false) ||
        (item.city?.toLowerCase().includes(query) ?? false) ||
        (item.category?.toLowerCase().includes(query) ?? false) ||
        (item.tags?.some(tag => tag.toLowerCase().includes(query)) ?? false)
    );
}

function matchesCategory(item: PartialService, category: string): boolean {
    if (!category) return true;
    return item.category?.toLowerCase() === category.toLowerCase();
}

/** Miasto ma priorytet nad wojewodztwem — tak samo jak przed refaktorem. */
function matchesLocation(item: PartialService, county: string, city: string): boolean {
    if (city) return item.city?.toLowerCase() === city.toLowerCase();
    if (county) return item.voivodeship?.toLowerCase() === county.toLowerCase();
    return true;
}

/**
 * Dzieli uslugi na dwa kubelki wyswietlane na jednym ekranie.
 *
 * @param services     Pelna lista z zapytania, w kolejnosci ustalonej przez baze.
 * @param filters      Aktywne filtry z URL-a.
 * @param alreadyShown Wpisy pokazane juz w innej sekcji tego ekranu (wyniki
 *                     semantyczne). Odejmowane od sekcji online, zeby ta sama
 *                     usluga nie pojawila sie dwa razy.
 *
 * UWAGA przy rozbudowie: jesli ekran dostanie CZWARTA sekcje, jej wpisy trzeba
 * dopisac do `alreadyShown`. Ta reguła jest jedynym zabezpieczeniem przed
 * podwojnym wyswietleniem wpisu `hybrid`.
 */
export function splitServicesByCoverage(
    services: PartialService[],
    filters: CoverageFilters,
    alreadyShown: PartialService[] = [],
): CoverageBuckets {
    const query = filters.query ? filters.query.toLowerCase().trim() : '';
    const category = filters.category ?? '';
    const county = filters.county ?? '';
    const city = filters.city ?? '';

    // Kategoria i tekst dzialaja na OBA kubelki — zasieg jest ortogonalny (R2, R7).
    const matching = services.filter(
        item => matchesQuery(item, query) && matchesCategory(item, category),
    );

    // Lista lokalna: tylko wpisy, ktore mozna odwiedzic, i tylko w wybranym miejscu.
    const localResults = filters.onlineOnly
        ? []
        : matching.filter(
              item => item.coverage !== 'online' && matchesLocation(item, county, city),
          );

    const shownIds = new Set([...localResults, ...alreadyShown].map(item => item.id));

    // Sekcja online: wszystko obslugiwane zdalnie, BEZ filtra geograficznego (R5),
    // minus to, co juz widac na ekranie (R6).
    const onlineResults = matching.filter(
        item => item.coverage !== 'local' && !shownIds.has(item.id),
    );

    return { localResults, onlineResults };
}
