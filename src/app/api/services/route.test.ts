/**
 * @jest-environment node
 */
// NextRequest wymaga fetch API, ktorego jsdom nie ma.
import { NextRequest } from 'next/server';

import { redis } from '@/lib/redis';
import { searchServicesSemantic } from '@/lib/semantic-search';

import { GET } from './route';

// Redis i OpenAI (za `searchServicesSemantic`) to zewnetrzne serwisy.
jest.mock('@/lib/redis', () => ({
    redis: { incr: jest.fn(), expire: jest.fn(), ttl: jest.fn() },
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
    jest.mocked(redis.incr).mockResolvedValue(1);
    jest.mocked(redis.expire).mockResolvedValue(1);
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
