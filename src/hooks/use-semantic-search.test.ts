import { act, renderHook, type RenderHookResult } from '@testing-library/react';

import type { CoverageFilters } from '@/lib/service-coverage';
import type { PartialService } from '@/types';

import { type SemanticSearchState, useSemanticSearch } from './use-semantic-search';

const DEBOUNCE_MS = 800;
const REQUEST_TIMEOUT_MS = 8000;

let counter = 0;

function service(name: string): PartialService {
    counter += 1;
    return {
        id: `id-${counter}`,
        serviceId: `service-${counter}`,
        slug: `slug-${counter}`,
        name,
        description: null,
        category: 'financial',
        coverage: 'local',
        tags: null,
        city: 'Warszawa',
        street: null,
        voivodeship: 'mazowieckie',
        postcode: null,
        latitude: 52.2297,
        longitude: 21.0122,
        openingHours: {},
        phoneNumber: null,
        email: null,
        webpage: null,
        image: null,
        languages: ['pl'],
        socials: null,
        whatsappNumber: null,
        verified: false,
    };
}

type PendingRequest = {
    url: string;
    signal: AbortSignal | undefined;
    respondWith: (services: PartialService[]) => void;
};

type HookProps = { filters: CoverageFilters; localResults: PartialService[]; locale: string };

// Pusta lista lokalna + fraza >= 3 znakow = zapytanie semantyczne rusza zawsze.
const NO_LOCAL_RESULTS: PartialService[] = [];
const props = (query: string): HookProps => ({
    filters: { query },
    localResults: NO_LOCAL_RESULTS,
    locale: 'pl',
});

const names = (state: SemanticSearchState): string[] => state.embeddingResults.map(s => s.name);

describe('useSemanticSearch', () => {
    const originalFetch = global.fetch;
    let pending: PendingRequest[];
    let fetchMock: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        pending = [];
        // /api/services to granica systemu — mockujemy tylko fetch. Mock ignoruje sygnal,
        // tak jak odpowiedz, ktora juz jest w drodze: hook sam musi ja odrzucic.
        fetchMock = jest.fn(
            (url: string, init?: RequestInit) =>
                new Promise(resolve => {
                    pending.push({
                        url,
                        signal: init?.signal ?? undefined,
                        respondWith: services =>
                            resolve({ ok: true, json: async () => ({ success: true, services }) }),
                    });
                }),
        );
        global.fetch = fetchMock;
    });

    afterEach(() => {
        jest.useRealTimers();
        global.fetch = originalFetch;
    });

    async function startSearch(
        query: string,
    ): Promise<RenderHookResult<SemanticSearchState, HookProps>> {
        const hook = renderHook((hookProps: HookProps) => useSemanticSearch(hookProps), {
            initialProps: props(query),
        });
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        return hook;
    }

    async function changeQuery(
        hook: RenderHookResult<SemanticSearchState, HookProps>,
        query: string,
    ): Promise<void> {
        hook.rerender(props(query));
        await act(async () => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
    }

    async function respond(request: PendingRequest | undefined, services: PartialService[]) {
        await act(async () => {
            request?.respondWith(services);
        });
    }

    it('po debounce pobiera wyniki i gasi ladowanie', async () => {
        const hook = await startSearch('tlumacz');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(hook.result.current.isLoadingEmbeddings).toBe(true);

        await respond(pending[0], [service('Tlumacz Przysiegly')]);

        expect(names(hook.result.current)).toEqual(['Tlumacz Przysiegly']);
        expect(hook.result.current.isLoadingEmbeddings).toBe(false);
    });

    // Regresja (review fazy 4, P2): bez AbortController starsza, wolniejsza odpowiedz
    // przychodzila ostatnia i nadpisywala wyniki nowszego zapytania.
    it('odpowiedz pierwszego zapytania po drugiej nie nadpisuje wynikow drugiego', async () => {
        const hook = await startSearch('tlumacz');
        await changeQuery(hook, 'notariusz');
        const [first, second] = pending;
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(first.signal?.aborted).toBe(true);
        expect(second.signal?.aborted).toBe(false);

        await respond(second, [service('Notariusz Nowak')]);
        await respond(first, [service('Tlumacz Stary')]);

        expect(names(hook.result.current)).toEqual(['Notariusz Nowak']);
        expect(hook.result.current.isLoadingEmbeddings).toBe(false);
    });

    it('spozniona odpowiedz przerwanego zapytania nie gasi ladowania nowego', async () => {
        const hook = await startSearch('tlumacz');
        await changeQuery(hook, 'notariusz');
        const [first, second] = pending;

        await respond(first, [service('Tlumacz Stary')]);

        expect(hook.result.current.isLoadingEmbeddings).toBe(true);
        expect(names(hook.result.current)).toEqual([]);

        await respond(second, [service('Notariusz Nowak')]);
        expect(names(hook.result.current)).toEqual(['Notariusz Nowak']);
    });

    it('odmontowanie przerywa zapytanie w locie', async () => {
        const hook = await startSearch('tlumacz');
        const [request] = pending;

        hook.unmount();

        expect(request.signal?.aborted).toBe(true);
        await respond(request, [service('Tlumacz Przysiegly')]);
    });

    it('timeout konczy ladowanie pusta lista i logiem bledu', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        // Prawdziwy fetch odrzuca obietnice, gdy sygnal zostaje przerwany.
        fetchMock.mockImplementation(
            (_url: string, init?: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () =>
                        reject(new DOMException('The operation was aborted.', 'AbortError')),
                    );
                }),
        );
        const hook = await startSearch('tlumacz');
        expect(hook.result.current.isLoadingEmbeddings).toBe(true);

        await act(async () => {
            jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
        });

        expect(hook.result.current.isLoadingEmbeddings).toBe(false);
        expect(names(hook.result.current)).toEqual([]);
        expect(consoleError).toHaveBeenCalledTimes(1);
        consoleError.mockRestore();
    });
});
