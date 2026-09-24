/**
 * Kiedy ekran mapy dopytuje wyszukiwanie semantyczne (`/api/services`).
 *
 * Czysta funkcja poza `services-client-component.tsx`, bo z tej samej reguly korzysta
 * skrypt `db:measure-search` — pomiar musi odpalac embeddingi dokladnie wtedy, kiedy
 * robi to UI, inaczej mierzylby wyniki, ktorych uzytkownik nigdy nie zobaczy.
 *
 * NIE dodawac tu `import 'server-only'` — funkcje wola Client Component.
 */

/** Ponizej tylu wynikow lokalnych lista jest uznawana za zbyt uboga. */
const MIN_LOCAL_RESULTS = 3;
const MIN_QUERY_LENGTH = 3;
const MIN_SEMANTIC_WORD_LENGTH = 5;
const SEMANTIC_INDICATORS: ReadonlySet<string> = new Set([
    'near',
    'close',
    'good',
    'best',
    'cheap',
    'expensive',
    'quality',
]);

export type SemanticSearchTriggerInput = {
    query: string;
    /** Dlugosc listy lokalnej ze `splitServicesByCoverage`, bez sekcji online. */
    localResultsCount: number;
    category?: string | null;
};

/** Zapytanie wielowyrazowe, ktore wyglada na opisowe, a nie na slowo kluczowe. */
function looksSemantic(query: string): boolean {
    if (!query.includes(' ')) return false;
    return query
        .toLowerCase()
        .split(/\s+/)
        .some(word => word.length >= MIN_SEMANTIC_WORD_LENGTH || SEMANTIC_INDICATORS.has(word));
}

export function shouldRunSemanticSearch({
    query,
    localResultsCount,
    category,
}: SemanticSearchTriggerInput): boolean {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return false;
    if (localResultsCount < MIN_LOCAL_RESULTS) return true;
    return Boolean(category) && looksSemantic(trimmed);
}
