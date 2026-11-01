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
jest.mock('../../../../../env', () => ({
    env: { SERVICE_SLUG_LOOKUP_SECRET: 's'.repeat(64) },
}));

const SECRET = 's'.repeat(64);
const SECRET_HEADER = 'x-service-slug-lookup-secret';
const CLIENT_IP = '203.0.113.7';
const RATE_LIMIT = 120;

function lookupWith(slug: string, headers: Record<string, string>): ReturnType<typeof GET> {
    const request = new NextRequest(`https://www.polvia.pl/api/service-slug/${slug}`, { headers });
    return GET(request, { params: Promise.resolve({ slug }) });
}

/** Klient publiczny z adresem ustawionym przez platforme (Vercel: `x-real-ip`). */
function lookup(slug: string, ip = CLIENT_IP): ReturnType<typeof GET> {
    return lookupWith(slug, { 'x-real-ip': ip });
}

/** Obietnica z kontekstu zadania: krotki adres reaguje na zmiane premium w 5 min. */
const PREMIUM_ALIAS_MAX_DELAY_SECONDS = 300;

/** Najstarsza odpowiedz, jaka CDN moze podac: `s-maxage + stale-while-revalidate`. */
function maxServedAgeSeconds(response: Response): number {
    const directives = response.headers.get('Cache-Control') ?? '';
    const seconds = (name: string): number =>
        Number(new RegExp(`${name}=(\\d+)`).exec(directives)?.[1] ?? 0);

    return seconds('s-maxage') + seconds('stale-while-revalidate');
}

async function exhaustLimit(headers: Record<string, string>): Promise<void> {
    for (let index = 0; index < RATE_LIMIT; index += 1) {
        expect((await lookupWith('kancelaria-nowak', headers)).status).toBe(200);
    }
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
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });

        const response = await lookup('kancelaria-nowak');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: { exists: true, hasActivePremium: false },
            error: null,
        });
        expect(getServiceSlugStatus).toHaveBeenCalledWith('kancelaria-nowak');
    });

    it('nieistniejacy slug daje 200 i exists: false', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: false, hasActivePremium: false });

        const response = await lookup('nie-istnieje');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: { exists: false, hasActivePremium: false },
            error: null,
        });
    });

    it('wpis z aktywnym premium daje hasActivePremium: true', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: true });

        const response = await lookup('kancelaria-nowak');

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: { exists: true, hasActivePremium: true },
            error: null,
        });
    });

    it('wpis z wygaslym premium daje hasActivePremium: false', async () => {
        // Wygasniecie rozstrzyga `isPremiumActive` w module zapytan (testy U8);
        // handler musi oddac jego wynik, a nie np. samo istnienie subskrypcji.
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });

        const response = await lookup('kancelaria-nowak');

        expect((await response.json()).data.hasActivePremium).toBe(false);
    });

    it('premium ma ten sam cache CDN co exists: true', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: true });

        const response = await lookup('kancelaria-nowak');

        expect(response.headers.get('Cache-Control')).toBe(
            'public, s-maxage=240, stale-while-revalidate=60',
        );
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
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });

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

    it('limit liczy sie per IP klienta z naglowka platformy', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });

        for (let index = 0; index < 121; index += 1) {
            await lookup('kancelaria-nowak', CLIENT_IP);
        }

        expect((await lookup('kancelaria-nowak', CLIENT_IP)).status).toBe(429);
        expect((await lookup('kancelaria-nowak', '198.51.100.1')).status).toBe(200);
        const viaVercelHeader = await lookupWith('kancelaria-nowak', {
            'x-vercel-forwarded-for': '198.51.100.2',
        });
        expect(viaVercelHeader.status).toBe(200);
    });

    it('podrobiony x-forwarded-for bez sekretu nie omija limitu', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });

        for (let index = 0; index < RATE_LIMIT; index += 1) {
            await lookupWith('kancelaria-nowak', {
                'x-real-ip': CLIENT_IP,
                'x-forwarded-for': `10.0.0.${index}`,
            });
        }

        const response = await lookupWith('kancelaria-nowak', {
            'x-real-ip': CLIENT_IP,
            'x-forwarded-for': '10.9.9.9',
        });
        expect(response.status).toBe(429);
    });

    it('bez naglowka platformy rotowany x-forwarded-for trafia do jednego kubelka', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });

        for (let index = 0; index < RATE_LIMIT; index += 1) {
            await lookupWith('kancelaria-nowak', { 'x-forwarded-for': `10.1.0.${index}` });
        }

        const response = await lookupWith('kancelaria-nowak', { 'x-forwarded-for': '10.1.1.1' });
        expect(response.status).toBe(429);
    });

    it('poprawny sekret (ruch z middleware) omija limit po IP', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });
        // Wszystkie fetche z middleware maja jeden adres wychodzacy — ten sam kubelek.
        const egressIp = '76.76.21.21';
        await exhaustLimit({ 'x-real-ip': egressIp });

        const response = await lookupWith('kancelaria-nowak', {
            'x-real-ip': egressIp,
            [SECRET_HEADER]: SECRET,
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            data: { exists: true, hasActivePremium: false },
            error: null,
        });
    });

    it.each(['zly-sekret', `${'s'.repeat(64)}x`, 's'.repeat(63), ''])(
        'zly sekret (%p) jest traktowany jak ruch publiczny',
        async secret => {
            jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });
            const headers = { 'x-real-ip': CLIENT_IP, [SECRET_HEADER]: secret };
            await exhaustLimit(headers);

            expect((await lookupWith('kancelaria-nowak', headers)).status).toBe(429);
        },
    );

    it('exists: true jest w CDN najwyzej 5 min razem ze stale-while-revalidate', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });

        const response = await lookup('kancelaria-nowak');

        expect(response.headers.get('Cache-Control')).toBe(
            'public, s-maxage=240, stale-while-revalidate=60',
        );
        expect(maxServedAgeSeconds(response)).toBeLessThanOrEqual(PREMIUM_ALIAS_MAX_DELAY_SECONDS);
    });

    it('exists: false jest cache-owane krotko, ze stale-while-revalidate', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: false, hasActivePremium: false });

        const response = await lookup('nie-istnieje');

        expect(response.headers.get('Cache-Control')).toBe(
            'public, s-maxage=30, stale-while-revalidate=300',
        );
    });

    it('429, 400 i 500 nie trafiaja do cache publicznego', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });
        await exhaustLimit({ 'x-real-ip': CLIENT_IP });
        const limited = await lookup('kancelaria-nowak');
        const badRequest = await lookupWith('ABC', { [SECRET_HEADER]: SECRET });
        jest.mocked(getServiceSlugStatus).mockRejectedValue(new Error('db down'));
        const failed = await lookupWith('kancelaria-nowak', { [SECRET_HEADER]: SECRET });

        expect([limited.status, badRequest.status, failed.status]).toEqual([429, 400, 500]);
        for (const response of [limited, badRequest, failed]) {
            expect(response.headers.get('Cache-Control')).toBe('private, no-store');
        }
    });

    it('awaria store limitu nie blokuje lookupu (fail-open) i jest logowana', async () => {
        jest.mocked(getServiceSlugStatus).mockResolvedValue({ exists: true, hasActivePremium: false });
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
        expect(await response.json()).toEqual({
            data: { exists: true, hasActivePremium: false },
            error: null,
        });
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
