/**
 * Parametry zapytania ekranu mapy do `/api/services`.
 *
 * Poza `services-client-component.tsx`, bo limit czyta tez skrypt `db:measure-search` —
 * pomiar ma liczyc tyle wynikow, ile widzi uzytkownik.
 *
 * NIE dodawac tu `import 'server-only'` — funkcje wola Client Component.
 */

/**
 * Tyle wynikow semantycznych prosi ekran mapy. Domyslne 3 z endpointu zostaje dla
 * konsumentow, ktorzy limitu nie podaja — przy nim "prawnik" pokazywal 3 z 8 kancelarii.
 *
 * Rowne `JUDGE_POOL_SIZE` w `semantic-search.ts`: model ocenia pule `max(limit, 10)`,
 * wiec do 10 koszt i czas oceny sa te same co przy limicie 3. Powyzej 10 pula rosnie
 * razem z limitem — dluzszy prompt i blizej `JUDGE_TIMEOUT_MS`.
 */
export const SEMANTIC_RECOMMENDATIONS_LIMIT = 10;

export type SemanticSearchRequest = {
    query: string;
    locale: string;
    category?: string;
    voivodeship?: string;
    /** Id firm pokazanych juz na ekranie. */
    excludeIds: string[];
};

export function buildSemanticSearchParams({
    query,
    locale,
    category,
    voivodeship,
    excludeIds,
}: SemanticSearchRequest): URLSearchParams {
    const params = new URLSearchParams();
    params.set('query', query);
    if (category) params.set('category', category);
    if (voivodeship) params.set('voivodeship', voivodeship);
    params.set('locale', locale);
    params.set('semanticOnly', 'true');
    params.set('limit', String(SEMANTIC_RECOMMENDATIONS_LIMIT));
    if (excludeIds.length > 0) params.set('excludeIds', excludeIds.join(','));
    return params;
}
