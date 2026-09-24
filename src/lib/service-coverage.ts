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

/**
 * Male litery bez polskich znakow — uzytkownik pisze raz "ksiegowa", raz "księgowa",
 * a dane sa niespojne w obie strony. `ł` nie rozklada sie w NFD, stad osobna zamiana.
 */
function foldForSearch(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
}

/**
 * Koncowki fleksyjne rzeczownikow i przymiotnikow (juz bez polskich znakow), najdluzsze
 * pierwsze. Swiadomie tylko odmiana, nie slowotworstwo: "prawnik" nie trafi w
 * "radca prawny" — to synonim, nie forma tego samego slowa.
 */
const INFLECTION_SUFFIXES = [
    'ami',
    'ach',
    'ego',
    'emu',
    'ych',
    'ymi',
    'owi',
    'iem',
    'ie',
    'ia',
    'iu',
    'ow',
    'om',
    'em',
    'y',
    'a',
    'e',
    'i',
    'u',
    'o',
];

/** Krotszy rdzen trafialby przypadkowo: "bary" → "bar" lapaloby "Barber". */
const MIN_STEM_LENGTH = 4;

/** "ubezpieczenie" → "ubezpieczen", zeby trafic tez "ubezpieczenia" i "ubezpieczeń". */
function stripInflection(term: string): string {
    const suffix = INFLECTION_SUFFIXES.find(
        ending => term.endsWith(ending) && term.length - ending.length >= MIN_STEM_LENGTH,
    );
    return suffix ? term.slice(0, -suffix.length) : term;
}

/**
 * Slowa zapytania szukane osobno: "kurs polskiego" musi trafic we wpis "Kursy języka
 * polskiego", a jako jeden ciag znakow nie trafial w nic.
 */
function toSearchTerms(query: string): string[] {
    return foldForSearch(query).split(/\s+/).filter(Boolean).map(stripInflection);
}

/**
 * Pola przeszukiwane jak w poprzednim `frontendFilteredServices`. Kazde slowo musi
 * trafic w ktores pole — jedno trafione slowo z dwoch nie wystarcza.
 */
function matchesQuery(item: PartialService, terms: string[]): boolean {
    if (terms.length === 0) return true;
    const fields = [item.name, item.description, item.city, item.category, ...(item.tags ?? [])]
        .filter(field => field != null)
        .map(foldForSearch);
    return terms.every(term => fields.some(field => field.includes(term)));
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
    const terms = toSearchTerms(filters.query ?? '');
    const category = filters.category ?? '';
    const county = filters.county ?? '';
    const city = filters.city ?? '';

    // Kategoria i tekst dzialaja na OBA kubelki — zasieg jest ortogonalny (R2, R7).
    const matching = services.filter(
        item => matchesQuery(item, terms) && matchesCategory(item, category),
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
