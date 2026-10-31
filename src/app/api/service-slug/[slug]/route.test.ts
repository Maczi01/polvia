/**
 * @jest-environment node
 */
// NextRequest wymaga fetch API, ktorego jsdom nie ma.
import { NextRequest } from 'next/server';

import { getServiceSlugStatus } from '@/lib/service-profile-queries';

import { createFakeRedis, type FakeMulti } from'../../../../../tests/fixtures/add-business/fake-redis';
import { GET } from './route';

const mockRedis = createFakeRedis();

// Redis i baza (za modulem zapytan) to zewnetrzne serwisy.
// Getter, bo fabryka `jest.mock` jest hoistowana nad inicjalizacje `mockRedis`.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));
jest.mock('@/lib/service-profile-queries', () => ({
    getServiceSlugStatus: jest.fn(),
}));

const CLIENT_IP = '203.0.113.7';

function lookup(slug: string, ip = CLIENT_IP): ReturnType<typeof GET> {
    const request = new NextRequest(`https://www.polvia.pl/api/service-slug/${slug}`, {
        headers: { 'x-forwarded-for': ip },
    });
    return GET(request, { params: Promise.resolve({ slug }) });
}

beforeEach(() => {
    mockRedis.reset();
    jest.mocked(getServiceSlugStatus).mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('GET /api/service-slug/[slug]', () => {
    it('istniejacy slug daje 200 i exists: true', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true });

        const response = await lookup('kancelaria-nowak');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: { exists: true }, error: null });
        expect(getServiceSlugStatus).toHaveBeenCalledWith('kancelaria-nowak');
    });

    it('nieistniejacy slug daje 200 i exists: false', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: false });

        const response = await lookup('nie-istnieje');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: { exists: false }, error: null });
    });

    it.each(['ABC', 'a_b', 'a--b', '-abc'])('niepoprawny format %s daje 400 bez zapytania do bazy', async slug => {
        const response = await lookup(slug);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.data).toBeNull();
        expect(body.error.code).toBe('BAD_REQUEST');
        expect(getServiceSlugStatus).not.toHaveBeenCalled();
    });

    it('po przekroczeniu limitu daje 429 z Retry-After i nie pyta bazy', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true });

        for (let index = 0; index < 120; index += 1) {
            expect((await lookup('kancelaria-nowak')).status).toBe(200);
        }
        jest.mocked(getServiceSlugStatus).mockClear();

        const response = await lookup('kancelaria-nowak');
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(body.error.code).toBe('RATE_LIMITED');
        expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
        expect(getServiceSlugStatus).not.toHaveBeenCalled();
    });

    it('limit liczy sie per IP klienta z x-forwarded-for', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true });

        for (let index = 0; index < 121; index += 1) {
            await lookup('kancelaria-nowak', CLIENT_IP);
        }

        expect((await lookup('kancelaria-nowak', CLIENT_IP)).status).toBe(429);
        expect((await lookup('kancelaria-nowak', '198.51.100.1')).status).toBe(200);
    });

    it('awaria store limitu nie blokuje lookupu (fail-open) i jest logowana', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true });
        // Transakcja bez wynikow (przerwane EXEC) — `checkRateLimit` rzuca RateLimitStoreError.
        const brokenMulti: FakeMulti = {
            set: () => brokenMulti,
            incr: () => brokenMulti,
            expire: () => brokenMulti,
            ttl: () => brokenMulti,
            exec: async () => [],
        };
        jest.spyOn(mockRedis, 'multi').mockReturnValue(brokenMulti);

        const response = await lookup('kancelaria-nowak');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: { exists: true }, error: null });
        expect(console.error).toHaveBeenCalled();
    });

    it('blad bazy daje 500 bez szczegolow bledu w odpowiedzi', async () => {
        jest.mocked(getServiceSlugStatus).mockRejectedValue(
            new Error('relation "services" does not exist'),
        );

        const response = await lookup('kancelaria-nowak');
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error.code).toBe('LOOKUP_FAILED');
        expect(JSON.stringify(body)).not.toContain('relation');
    });
});
