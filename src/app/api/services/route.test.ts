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
