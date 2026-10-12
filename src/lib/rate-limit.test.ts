import { createFakeRedis, type FakeMulti } from '../../tests/fixtures/add-business/fake-redis';
import {
    checkRateLimit,
    getClientIp,
    peekRateLimit,
    rateLimitSubject,
    RateLimitStoreError,
    type RequestWithHeaders,
} from './rate-limit';

const mockRedis = createFakeRedis();

// Redis to zewnetrzny serwis — jedyna rzecz, ktora wolno tu zamockowac. Getter, bo
// fabryka `jest.mock` jest hoistowana nad inicjalizacje `mockRedis`.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

/**
 * jsdom nie ma globalnego `Request`, a `getClientIp` i tak czyta wylacznie
 * naglowki — stad atrapa zamiast polyfilla fetch API.
 */
function request(headers: Record<string, string>): RequestWithHeaders {
    return { headers: { get: name => headers[name] ?? null } };
}

beforeEach(() => {
    mockRedis.reset();
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

describe('rateLimitSubject', () => {
    it('dwa adresy z tej samej sieci /64 daja ten sam podmiot', () => {
        const first = rateLimitSubject('2001:db8:abcd:12:1111:2222:3333:4444');
        const second = rateLimitSubject('2001:db8:abcd:12:ffff:0:0:1');

        expect(first).toBe(second);
        expect(first).toBe('2001:db8:abcd:12::/64');
    });

    it('adresy z roznych sieci /64 daja rozne podmioty', () => {
        expect(rateLimitSubject('2001:db8:abcd:12::1')).not.toBe(
            rateLimitSubject('2001:db8:abcd:13::1'),
        );
    });

    it('rozwija zapis skrocony i ignoruje wielkosc liter', () => {
        expect(rateLimitSubject('2001:DB8::1')).toBe('2001:db8:0:0::/64');
        expect(rateLimitSubject('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(
            '2001:db8:0:0::/64',
        );
    });

    it('IPv4 zmapowany w IPv6 sprowadza do czystego IPv4', () => {
        expect(rateLimitSubject('::ffff:1.2.3.4')).toBe('1.2.3.4');
        expect(rateLimitSubject('::ffff:0102:0304')).toBe('1.2.3.4');
    });

    it('IPv4 zostawia bez zmian', () => {
        expect(rateLimitSubject('203.0.113.7')).toBe('203.0.113.7');
    });

    it('tekst, ktory nie jest adresem IP, zostawia bez zmian', () => {
        expect(rateLimitSubject('unknown')).toBe('unknown');
        expect(rateLimitSubject('2001:db8::g')).toBe('2001:db8::g');
    });
});

describe('checkRateLimit', () => {
    const options = { key: 'search:1.2.3.4', max: 30, windowSeconds: 60 };

    it('przepuszcza zapytanie ponizej limitu', async () => {
        mockRedis.seed(options.key, '2', 60);

        const result = await checkRateLimit(options);

        expect(result).toEqual({ allowed: true, remaining: 27 });
    });

    it('ustawia TTL tylko przy pierwszym zapytaniu w oknie', async () => {
        await checkRateLimit(options);

        expect(await mockRedis.ttl(options.key)).toBe(60);
    });

    it('nie odswieza TTL przy kolejnych zapytaniach', async () => {
        await checkRateLimit(options);
        mockRedis.advance(20);

        await checkRateLimit(options);

        // Odswiezanie TTL przy kazdym zapytaniu zamienia okno przesuwne w blokade
        // wieczna: zablokowany klient odnawialby sobie kare kazda kolejna proba.
        expect(await mockRedis.ttl(options.key)).toBe(40);
    });

    it('blokuje po przekroczeniu limitu i oddaje czas do konca okna', async () => {
        mockRedis.seed(options.key, '30', 42);

        const result = await checkRateLimit(options);

        expect(result).toEqual({ allowed: false, retryAfter: 42 });
    });

    it('przy braku TTL oddaje pelne okno zamiast ujemnej liczby', async () => {
        // Klucz bez TTL — zostawiony przez dawne nieatomowe INCR + EXPIRE.
        // `Retry-After: -1` byloby nagłówkiem nie do uzycia.
        mockRedis.seed(options.key, '30');

        const result = await checkRateLimit(options);

        expect(result).toEqual({ allowed: false, retryAfter: 60 });
    });

    it('klucz bez TTL dostaje TTL okna (samonaprawa) i po oknie wygasa', async () => {
        mockRedis.seed(options.key, '30');

        await checkRateLimit(options);

        expect(await mockRedis.ttl(options.key)).toBe(60);
        mockRedis.advance(60);
        expect(await checkRateLimit(options)).toEqual({ allowed: true, remaining: 29 });
    });

    it('licznik powstaje od razu z TTL, w jednej transakcji z INCR', async () => {
        const multi = jest.spyOn(mockRedis, 'multi');

        await checkRateLimit(options);

        expect(multi).toHaveBeenCalledTimes(1);
        expect(await mockRedis.get(options.key)).toBe('1');
        expect(await mockRedis.ttl(options.key)).toBe(60);
        multi.mockRestore();
    });

    it('wartosc, ktorej Redis nie umie zinkrementowac, konczy sie bledem typowanym', async () => {
        const failing: FakeMulti = {
            set: () => failing,
            incr: () => failing,
            expire: () => failing,
            ttl: () => failing,
            exec: async () => [
                [null, null],
                [new Error('ERR value is not an integer'), null],
                [null, 60],
            ],
        };
        const multi = jest.spyOn(mockRedis, 'multi').mockReturnValue(failing);

        await expect(checkRateLimit(options)).rejects.toBeInstanceOf(RateLimitStoreError);
        multi.mockRestore();
    });
});

describe('peekRateLimit', () => {
    const options = { key: 'add-business:gen:1.2.3.4', max: 2, windowSeconds: 86_400 };

    it('przy braku licznika przepuszcza z pelna pula', async () => {
        expect(await peekRateLimit(options)).toEqual({ allowed: true, remaining: 2 });
    });

    it('nie inkrementuje licznika', async () => {
        mockRedis.seed(options.key, '1', 3600);

        const result = await peekRateLimit(options);

        expect(result).toEqual({ allowed: true, remaining: 1 });
        expect(await mockRedis.get(options.key)).toBe('1');
        expect(await mockRedis.ttl(options.key)).toBe(3600);
    });

    it('odmawia, gdy kolejne zapytanie przekroczyloby limit', async () => {
        mockRedis.seed(options.key, '2', 3600);

        expect(await peekRateLimit(options)).toEqual({ allowed: false, retryAfter: 3600 });
    });

    it('przy braku TTL oddaje pelne okno', async () => {
        mockRedis.seed(options.key, '5');

        expect(await peekRateLimit(options)).toEqual({ allowed: false, retryAfter: 86_400 });
    });
});
