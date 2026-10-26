import { type Dispatch, useEffect, useReducer, useRef } from 'react';

import { semanticSearchKey } from '@/lib/semantic-search-key';
import { buildSemanticSearchParams } from '@/lib/semantic-search-request';
import { shouldRunSemanticSearch } from '@/lib/semantic-search-trigger';
import type { CoverageFilters } from '@/lib/service-coverage';
import type { PartialService } from '@/types';

const DEBOUNCE_MS = 800;
const REQUEST_TIMEOUT_MS = 8000;

export type EmbeddingMeta = {
    executionTime?: number;
    contextualQuery?: string;
    relevanceThreshold?: number;
    count?: number;
    query?: string;
    category?: string;
} | null;

export type SemanticSearchState = {
    embeddingResults: PartialService[];
    isLoadingEmbeddings: boolean;
    embeddingMeta: EmbeddingMeta;
};

type SemanticSearchOptions = {
    filters: CoverageFilters;
    /** Lista lokalna — jej dlugosc decyduje o zapytaniu, a id ida jako `excludeIds`. */
    localResults: PartialService[];
    locale: string;
};

type SemanticRequest = {
    query: string;
    locale: string;
    category?: string;
    county?: string;
    excludeIds: string[];
};

type SemanticSearchResponse = {
    success: boolean;
    services?: PartialService[];
    executionTime?: number;
    contextualQuery?: string;
    relevanceThreshold?: number;
    count?: number;
    query?: string;
    filters?: { category?: string };
    error?: { code?: string };
};

type SemanticSearchAction =
    | { type: 'reset'; isLoading: boolean }
    | { type: 'results'; services: PartialService[]; meta: EmbeddingMeta }
    | { type: 'clear' }
    | { type: 'settled' };

const INITIAL_STATE: SemanticSearchState = {
    embeddingResults: [],
    isLoadingEmbeddings: false,
    embeddingMeta: null,
};

function semanticSearchReducer(
    state: SemanticSearchState,
    action: SemanticSearchAction,
): SemanticSearchState {
    switch (action.type) {
        case 'reset': {
            return {
                embeddingResults: [],
                embeddingMeta: null,
                isLoadingEmbeddings: action.isLoading,
            };
        }
        case 'results': {
            return { ...state, embeddingResults: action.services, embeddingMeta: action.meta };
        }
        case 'clear': {
            return { ...state, embeddingResults: [], embeddingMeta: null };
        }
        case 'settled': {
            return { ...state, isLoadingEmbeddings: false };
        }
    }
}

async function requestSemanticResults(
    { query, locale, category, county, excludeIds }: SemanticRequest,
    signal: AbortSignal,
): Promise<SemanticSearchResponse> {
    // `/api/services` czyta `voivodeship` — pod `county` filtr byl po cichu
    // ignorowany, a limit zapelnialy wyniki z innych wojewodztw.
    const params = buildSemanticSearchParams({
        query,
        locale,
        category,
        voivodeship: county,
        excludeIds,
    });
    const response = await fetch(`/api/services?${params}`, { signal });
    if (!response.ok) throw new Error(`API responded with ${response.status}`);

    const data: SemanticSearchResponse = await response.json();
    return data;
}

/**
 * Jedno zapytanie semantyczne na wlasnym kontrolerze. Timeout przerywa ten sam kontroler
 * (`AbortSignal.any` nie ma w jsdom ani w Safari < 17.4) i konczy sie jak kazdy blad: logiem
 * i pusta lista. Przerwanie z zewnatrz (nowsze zapytanie, cleanup efektu) nie dotyka stanu —
 * ten nalezy juz do nowszego zapytania, wiec nie czyscimy wynikow ani nie gasimy ladowania.
 */
async function runSemanticRequest(
    request: SemanticRequest,
    controller: AbortController,
    dispatch: Dispatch<SemanticSearchAction>,
): Promise<void> {
    let isTimedOut = false;
    const timeoutId = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const isCancelled = (): boolean => controller.signal.aborted && !isTimedOut;

    try {
        const data = await requestSemanticResults(request, controller.signal);
        if (isCancelled()) return;

        if (data.success) {
            dispatch({ type: 'results', services: data.services ?? [], meta: toMeta(data) });
            return;
        }
        // Zostaje jako `error`, nie `log`: to jedyna sciezka, w ktorej wyszukiwanie
        // semantyczne cicho oddaje pusta liste. Bez tego brak wynikow jest
        // nieodroznialny od braku dopasowan.
        console.error('Semantic search failed', {
            query: request.query,
            category: request.category ?? null,
            code: data.error?.code,
        });
        dispatch({ type: 'clear' });
    } catch (error) {
        if (isCancelled()) return;
        console.error('❌ Semantic search error:', error);
        dispatch({ type: 'clear' });
    } finally {
        clearTimeout(timeoutId);
        if (!isCancelled()) dispatch({ type: 'settled' });
    }
}

function toMeta(data: SemanticSearchResponse): EmbeddingMeta {
    return {
        executionTime: data.executionTime,
        contextualQuery: data.contextualQuery,
        relevanceThreshold: data.relevanceThreshold,
        count: data.count,
        query: data.query,
        category: data.filters?.category,
    };
}

/**
 * Wyniki semantyczne `/api/services` dla ekranu mapy: debounce, deduplikacja kluczem osi
 * i przerywanie zapytan w locie. Starsza, wolniejsza odpowiedz nie nadpisze nowszej ani nie
 * zgasi jej ladowania — kazda zmiana filtrow przerywa poprzednie zapytanie.
 */
export function useSemanticSearch({
    filters,
    localResults,
    locale,
}: SemanticSearchOptions): SemanticSearchState {
    const [state, dispatch] = useReducer(semanticSearchReducer, INITIAL_STATE);
    const lastSearchParamsRef = useRef('');
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Kazda os zmieniajaca liste lokalna — inaczej zmiana jezyka/miasta czysci wyniki,
        // a pominiety klucz blokuje ponowne zapytanie.
        const currentSearchParams = semanticSearchKey(filters);
        const query = filters.query ?? '';
        const category = filters.category || undefined;

        // Te same parametry nie odpytuja API drugi raz; reszte reguly dzieli ze skryptem pomiaru.
        const shouldTriggerEmbeddingSearch =
            currentSearchParams !== lastSearchParamsRef.current &&
            shouldRunSemanticSearch({ query, localResultsCount: localResults.length, category });

        dispatch({ type: 'reset', isLoading: shouldTriggerEmbeddingSearch });
        if (!shouldTriggerEmbeddingSearch) {
            lastSearchParamsRef.current = currentSearchParams;
            return;
        }

        const debounceTimeoutId = setTimeout(() => {
            controllerRef.current?.abort();
            const controller = new AbortController();
            controllerRef.current = controller;
            lastSearchParamsRef.current = currentSearchParams;

            const request: SemanticRequest = {
                query: query.trim(),
                locale,
                category,
                county: filters.county || undefined,
                excludeIds: localResults.map(s => s.serviceId),
            };
            void runSemanticRequest(request, controller, dispatch).finally(() => {
                if (controllerRef.current === controller) controllerRef.current = null;
            });
        }, DEBOUNCE_MS);

        return () => {
            clearTimeout(debounceTimeoutId);
            if (!controllerRef.current) return;
            // Przerwane zapytanie nie dostarczy wynikow, a nastepny przebieg efektu i tak
            // je czysci — ten sam klucz musi wiec moc odpytac API ponownie.
            controllerRef.current.abort();
            controllerRef.current = null;
            lastSearchParamsRef.current = '';
        };
    }, [filters, localResults, locale]);

    return state;
}
