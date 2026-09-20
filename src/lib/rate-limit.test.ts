import { checkRateLimit, getClientIp, type RequestWithHeaders } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

// Redis to zewnetrzny serwis — jedyna rzecz, ktora wolno tu zamockowac.
jest.mock('@/lib/redis', () => ({
    redis: {
        incr: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
    },
}));

const mockRedis = redis as unknown as {
    incr: jest.Mock;
    expire: jest.Mock;
    ttl: jest.Mock;
};

/**
 * jsdom nie ma globalnego `Request`, a `getClientIp` i tak czyta wylacznie
 * naglowki — stad atrapa zamiast polyfilla fetch API.
 */
function request(headers: Record<string, string>): RequestWithHeaders {
    return { headers: { get: name => headers[name] ?? null } };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getClientIp', () => {
    it('bierze pierwszy adres z x-forwarded-for', () => {
        const ip = getClientIp(request({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' }));

        expect(ip).toBe('203.0.113.7');
    });

    it('spada na x-real-ip, gdy nie ma x-forwarded-for', () => {
        expect(getClientIp(request({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    });

    it('spada na cf-connecting-ip jako ostatni naglowek', () => {
        expect(getClientIp(request({ 'cf-connecting-ip': '198.51.100.9' }))).toBe('198.51.100.9');
    });

    it('bez zadnego naglowka zwraca localhost', () => {
        expect(getClientIp(request({}))).toBe('127.0.0.1');
    });
});

describe('checkRateLimit', () => {
    it('przepuszcza zapytanie ponizej limitu', async () => {
        mockRedis.incr.mockResolvedValue(3);

        const result = await checkRateLimit({ key: 'search:1.2.3.4', max: 30, windowSeconds: 60 });

        expect(result).toEqual({ allowed: true, remaining: 27 });
    });

    it('ustawia TTL tylko przy pierwszym zapytaniu w oknie', async () => {
        mockRedis.incr.mockResolvedValue(1);

        await checkRateLimit({ key: 'search:1.2.3.4', max: 30, windowSeconds: 60 });

        expect(mockRedis.expire).toHaveBeenCalledWith('search:1.2.3.4', 60);
    });

    it('nie odswieza TTL przy kolejnych zapytaniach', async () => {
        mockRedis.incr.mockResolvedValue(2);

        await checkRateLimit({ key: 'search:1.2.3.4', max: 30, windowSeconds: 60 });

        // Odswiezanie TTL przy kazdym zapytaniu zamienia okno przesuwne w blokade
        // wieczna: zablokowany klient odnawialby sobie kare kazda kolejna proba.
        expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('blokuje po przekroczeniu limitu i oddaje czas do konca okna', async () => {
        mockRedis.incr.mockResolvedValue(31);
        mockRedis.ttl.mockResolvedValue(42);

        const result = await checkRateLimit({ key: 'search:1.2.3.4', max: 30, windowSeconds: 60 });

        expect(result).toEqual({ allowed: false, retryAfter: 42 });
    });

    it('przy braku TTL oddaje pelne okno zamiast ujemnej liczby', async () => {
        mockRedis.incr.mockResolvedValue(31);
        // -1 = klucz bez TTL, -2 = klucz zniknal miedzy INCR a TTL. Oba realne przy
        // wyscigu z wygasnieciem; `Retry-After: -1` byloby nagłówkiem nie do uzycia.
        mockRedis.ttl.mockResolvedValue(-2);

        const result = await checkRateLimit({ key: 'search:1.2.3.4', max: 30, windowSeconds: 60 });

        expect(result).toEqual({ allowed: false, retryAfter: 60 });
    });
});
