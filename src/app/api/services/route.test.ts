/**
 * @jest-environment node
 */
// NextRequest wymaga fetch API, ktorego jsdom nie ma.
import { NextRequest } from 'next/server';

import { searchServicesSemantic } from '@/lib/semantic-search';
import { buildSemanticSearchParams, MAX_EXCLUDE_IDS } from '@/lib/semantic-search-request';

import { createFakeRedis } from '../../../../tests/fixtures/add-business/fake-redis';
import { GET } from './route';

const mockRedis = createFakeRedis();

// Redis i OpenAI (za `searchServicesSemantic`) to zewnetrzne serwisy.
// Getter, bo fabryka `jest.mock` jest hoistowana nad inicjalizacje `mockRedis`.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));
jest.mock('@/lib/semantic-search', () => ({
    DEFAULT_SEMANTIC_LIMIT: 3,
    searchServicesSemantic: jest.fn(),
}));

const UPSTREAM_MESSAGE = '401 Incorrect API key provided: sk-proj-****zOcA';

function request(query: string): NextRequest {
    return new NextRequest(`https://www.polvia.pl/api/services?query=${query}&locale=pl`);
}

beforeEach(() => {
    mockRedis.reset();
});

describe('GET /api/services', () => {
    it('zwraca wyniki wyszukiwania przy poprawnym zapytaniu', async () => {
        jest.mocked(searchServicesSemantic).mockResolvedValue({
            services: [],
            contextualQuery: 'prawnik',
            relevanceCheck: 'passed',
        });

        const response = await GET(request('prawnik'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.count).toBe(0);
    });

    describe('limit', () => {
        function searchedLimit(): number | undefined {
            return jest.mocked(searchServicesSemantic).mock.calls[0]?.[0].limit;
        }

        beforeEach(() => {
            jest.mocked(searchServicesSemantic).mockReset().mockResolvedValue({
                services: [],
                contextualQuery: 'prawnik',
                relevanceCheck: 'passed',
            });
        });

        it('respektuje limit podany przez klienta', async () => {
            await GET(new NextRequest('https://www.polvia.pl/api/services?query=prawnik&limit=10'));

            expect(searchedLimit()).toBe(10);
        });

        it('bez parametru stosuje limit domyslny', async () => {
            await GET(request('prawnik'));

            expect(searchedLimit()).toBe(3);
        });

        it('pusty parametr traktuje jak brak parametru', async () => {
            await GET(new NextRequest('https://www.polvia.pl/api/services?query=prawnik&limit='));

            expect(searchedLimit()).toBe(3);
        });

        it('odrzuca limit powyzej gornej granicy', async () => {
            const response = await GET(
                new NextRequest('https://www.polvia.pl/api/services?query=prawnik&limit=51'),
            );

            expect(response.status).toBe(400);
            expect(searchServicesSemantic).not.toHaveBeenCalled();
        });
    });

    describe('excludeIds z ekranu mapy', () => {
        const SHOWN_SERVICES = 60;

        function shownIds(count: number): string[] {
            return Array.from(
                { length: count },
                (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
            );
        }

        beforeEach(() => {
            jest.mocked(searchServicesSemantic).mockReset().mockResolvedValue({
                services: [],
                contextualQuery: 'prawnik',
                relevanceCheck: 'passed',
            });
        });

        it('przyjmuje zapytanie mapy z wieloma firmami na ekranie i wyklucza je wszystkie', async () => {
            const excludeIds = shownIds(SHOWN_SERVICES);
            const params = buildSemanticSearchParams({
                query: 'prawnik po ukrainsku',
                locale: 'pl',
                category: 'law',
                excludeIds,
            });

            const response = await GET(
                new NextRequest(`https://www.polvia.pl/api/services?${params}`),
            );

            expect(response.status).toBe(200);
            expect(jest.mocked(searchServicesSemantic).mock.calls[0]?.[0].excludeIds).toEqual(
                excludeIds,
            );
        });

        it('odrzuca liste ponad limit firm', async () => {
            const params = new URLSearchParams({
                query: 'prawnik',
                excludeIds: shownIds(MAX_EXCLUDE_IDS + 1).join(','),
            });

            const response = await GET(
                new NextRequest(`https://www.polvia.pl/api/services?${params}`),
            );

            expect(response.status).toBe(400);
            expect(searchServicesSemantic).not.toHaveBeenCalled();
        });

        it('odrzuca id, ktore nie jest UUID-em', async () => {
            const response = await GET(
                new NextRequest(
                    'https://www.polvia.pl/api/services?query=prawnik&excludeIds=1%20OR%201%3D1',
                ),
            );

            expect(response.status).toBe(400);
            expect(searchServicesSemantic).not.toHaveBeenCalled();
        });
    });

    describe('awaria wyszukiwania', () => {
        it('zwraca 500 ze stalym kodem bledu', async () => {
            jest.mocked(searchServicesSemantic).mockRejectedValue(new Error(UPSTREAM_MESSAGE));

            const response = await GET(request('prawnik'));
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body).toEqual({
                success: false,
                error: { code: 'SEARCH_FAILED', message: 'Search failed' },
            });
        });

        it('nie przekazuje klientowi komunikatu od dostawcy', async () => {
            jest.mocked(searchServicesSemantic).mockRejectedValue(new Error(UPSTREAM_MESSAGE));

            const response = await GET(request('prawnik'));

            expect(await response.text()).not.toContain('API key');
        });
    });
});
