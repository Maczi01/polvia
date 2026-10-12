/**
 * @jest-environment node
 */
// AbortSignal.timeout i Response istnieja w Node, nie w jsdom.
import { redis } from '@/lib/redis';

import { geocodeAddress, isGeoInPoland, mapVoivodeship } from './geocode';

// Redis i Nominatim (przez wstrzykniety fetch) to zewnetrzne serwisy.
jest.mock('@/lib/redis', () => ({
    redis: { get: jest.fn(), set: jest.fn() },
}));

// env.ts laduje @t3-oss/env-nextjs (wylacznie ESM) — podajemy zmienne jawnie.
jest.mock('../../../env', () => ({
    env: { NEXT_PUBLIC_SITE_URL: 'https://polvia.test' },
}));

const mockGet = jest.mocked(redis.get);
const mockSet = jest.mocked(redis.set);

const ADDRESS = { street: 'Marszałkowska 10', city: 'Warszawa' };

const WARSAW_HIT = {
    lat: '52.2297',
    lon: '21.0122',
    display_name: 'Marszałkowska 10, Śródmieście, Warszawa, województwo mazowieckie, Polska',
    address: {
        house_number: '10',
        postcode: '00-590',
        state: 'województwo mazowieckie',
    },
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function fetchReturning(response: Response): jest.Mock {
    return jest.fn().mockResolvedValue(response);
}

const noSleep = jest.fn((): Promise<void> => Promise.resolve());

beforeEach(() => {
    mockGet.mockReset().mockResolvedValue(null);
    // Pierwsze wywolanie `set` to blokada (OK = przyznana), kolejne to zapis cache.
    mockSet.mockReset().mockResolvedValue('OK');
    noSleep.mockClear();
});

describe('geocodeAddress', () => {
    it('zwraca wspolrzedne, kod pocztowy i wojewodztwo oraz zapisuje wynik w cache na 30 dni', async () => {
        const fetchImpl = fetchReturning(jsonResponse([WARSAW_HIT]));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({
            ok: true,
            lat: 52.2297,
            lng: 21.0122,
            postcode: '00-590',
            voivodeship: 'mazowieckie',
            approximate: false,
        });
        expect(mockSet).toHaveBeenCalledWith(
            expect.stringContaining('marszalkowska 10, warszawa'),
            expect.any(String),
            'EX',
            60 * 60 * 24 * 30,
        );
    });

    it('wysyla zapytanie zgodne z polityka Nominatim', async () => {
        const fetchImpl = fetchReturning(jsonResponse([WARSAW_HIT]));

        await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        const [url, init] = fetchImpl.mock.calls[0];
        const params = new URL(url).searchParams;
        expect(params.get('countrycodes')).toBe('pl');
        expect(params.get('format')).toBe('jsonv2');
        expect(params.get('limit')).toBe('1');
        expect(params.get('addressdetails')).toBe('1');
        expect(params.get('q')).toBe('Marszałkowska 10, Warszawa');
        expect(init.headers['User-Agent']).toContain('https://polvia.test');
        expect(mockSet).toHaveBeenCalledWith(expect.any(String), '1', 'PX', 1000, 'NX');
    });

    it.each([
        ['ul. Mickiewicza 24/4B', 'Mickiewicza 24, Poznań'],
        ['Ulica Mickiewicza 24 / 4', 'Mickiewicza 24, Poznań'],
        ['al. Jerozolimskie 65/79', 'al. Jerozolimskie 65, Poznań'],
    ])('zdejmuje „ul.” i numer lokalu przed zapytaniem: %s', async (street, query) => {
        const fetchImpl = fetchReturning(jsonResponse([]));

        await geocodeAddress({ street, city: 'Poznań' }, { fetchImpl, sleep: noSleep });

        expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get('q')).toBe(query);
    });

    it('przy trafieniu w cache nie wola fetch', async () => {
        mockGet.mockResolvedValue(JSON.stringify({ hit: WARSAW_HIT }));
        const fetchImpl = jest.fn();

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(result).toMatchObject({ ok: true, lat: 52.2297, lng: 21.0122 });
    });

    it('cache’uje „nie znaleziono” i zwraca NOT_FOUND', async () => {
        const fetchImpl = fetchReturning(jsonResponse([]));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({ ok: false, code: 'NOT_FOUND' });
        expect(mockSet).toHaveBeenCalledWith(
            expect.any(String),
            JSON.stringify({ hit: null }),
            'EX',
            expect.any(Number),
        );
    });

    it('zwraca MISMATCH, gdy display_name wskazuje inne miasto', async () => {
        const otherCity = { ...WARSAW_HIT, display_name: 'Marszałkowska 10, Kraków, Polska' };
        const fetchImpl = fetchReturning(jsonResponse([otherCity]));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({ ok: false, code: 'MISMATCH' });
    });

    it('zwraca MISMATCH dla wspolrzednych spoza Polski', async () => {
        const outside = { ...WARSAW_HIT, lat: '48.2082', lon: '16.3738' };
        const fetchImpl = fetchReturning(jsonResponse([outside]));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({ ok: false, code: 'MISMATCH' });
    });

    it('oznacza wynik bez numeru budynku jako przyblizony', async () => {
        const streetOnly = {
            ...WARSAW_HIT,
            address: { postcode: '00-590', state: 'województwo mazowieckie' },
        };
        const fetchImpl = fetchReturning(jsonResponse([streetOnly]));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toMatchObject({ ok: true, approximate: true });
    });

    it('zwraca RATE_LIMITED bez wywolania sieci, gdy blokada jest zajeta przy obu probach', async () => {
        mockSet.mockResolvedValue(null);
        const fetchImpl = jest.fn();

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({ ok: false, code: 'RATE_LIMITED' });
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(noSleep).toHaveBeenCalledTimes(1);
        expect(mockSet).toHaveBeenCalledTimes(2);
    });

    it('ponawia raz i odpytuje Nominatim, gdy blokada zwolni sie przy drugiej probie', async () => {
        mockSet.mockResolvedValueOnce(null).mockResolvedValue('OK');
        const fetchImpl = fetchReturning(jsonResponse([WARSAW_HIT]));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toMatchObject({ ok: true });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('zwraca UPSTREAM_FAILED przy HTTP 500 i nie zapisuje cache', async () => {
        const fetchImpl = fetchReturning(jsonResponse({ error: 'boom' }, 500));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({ ok: false, code: 'UPSTREAM_FAILED' });
        // Jedyne `set` to blokada — wynik bledu nie trafia do cache.
        expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it('zwraca UPSTREAM_FAILED dla odpowiedzi niezgodnej ze schematem', async () => {
        const fetchImpl = fetchReturning(jsonResponse([{ lat: 'abc', display_name: 1 }]));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({ ok: false, code: 'UPSTREAM_FAILED' });
    });

    it('zwraca UPSTREAM_FAILED, gdy fetch rzuci (timeout, siec)', async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new Error('timeout'));

        const result = await geocodeAddress(ADDRESS, { fetchImpl, sleep: noSleep });

        expect(result).toEqual({ ok: false, code: 'UPSTREAM_FAILED' });
    });

    it('pomija Nominatim i cache, gdy JSON-LD ma geo w zakresie Polski', async () => {
        const fetchImpl = jest.fn();

        const result = await geocodeAddress(ADDRESS, {
            knownGeo: { lat: 50.06, lng: 19.94 },
            fetchImpl,
            sleep: noSleep,
        });

        expect(result).toEqual({
            ok: true,
            lat: 50.06,
            lng: 19.94,
            postcode: null,
            voivodeship: null,
            approximate: false,
        });
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(mockGet).not.toHaveBeenCalled();
    });

    it('ignoruje geo z JSON-LD spoza Polski i geokoduje adres', async () => {
        const fetchImpl = fetchReturning(jsonResponse([WARSAW_HIT]));

        await geocodeAddress(ADDRESS, { knownGeo: { lat: 0, lng: 0 }, fetchImpl, sleep: noSleep });

        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
});

describe('mapVoivodeship', () => {
    it('mapuje „województwo mazowieckie” na enum', () => {
        expect(mapVoivodeship('województwo mazowieckie')).toBe('mazowieckie');
    });

    it('obsluguje polskie znaki i nazwy dwuczlonowe', () => {
        expect(mapVoivodeship('województwo łódzkie')).toBe('lodzkie');
        expect(mapVoivodeship('województwo warmińsko-mazurskie')).toBe('warminsko-mazurskie');
        expect(mapVoivodeship('województwo śląskie')).toBe('slaskie');
    });

    it('zwraca null dla nieznanej nazwy albo jej braku', () => {
        expect(mapVoivodeship('Bayern')).toBeNull();
        expect(mapVoivodeship()).toBeNull();
    });
});

describe('isGeoInPoland', () => {
    it('akceptuje punkt w Polsce i odrzuca punkt poza nia', () => {
        expect(isGeoInPoland({ lat: 52.23, lng: 21.01 })).toBe(true);
        expect(isGeoInPoland({ lat: 48.2, lng: 16.37 })).toBe(false);
        expect(isGeoInPoland(null)).toBe(false);
    });
});
