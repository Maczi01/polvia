import 'server-only';

import { isIPv4, isIPv6 } from 'node:net';

import { redis } from '@/lib/redis';

/**
 * Wspoldzielony licznik zapytan na Redisie.
 *
 * Wydzielony, bo to drugie uzycie: `submit-contact-query` mial wlasna kopie
 * odczytu IP, a `/api/services` potrzebuje tego samego. Trzeciego kopiowania
 * juz nie ma po co robic.
 */

export interface RateLimitOptions {
    /** Pelny klucz w Redisie, razem z prefiksem endpointu. */
    key: string;
    /** Ile zapytan wolno w oknie. */
    max: number;
    /** Dlugosc okna w sekundach. */
    windowSeconds: number;
}

export type RateLimitResult =
    | { allowed: true; remaining: number }
    | { allowed: false; retryAfter: number };

/**
 * Minimum, ktorego potrzebuje `getClientIp`. Celowo wezsze niz `Request`:
 * funkcja czyta wylacznie naglowki, a taka sygnatura przyjmuje zarowno `Request`
 * jak i `NextRequest` i daje sie wywolac w tescie bez polyfilla fetch API.
 */
export interface RequestWithHeaders {
    headers: { get(name: string): string | null };
}

/**
 * Adres klienta zza proxy. Kolejnosc naglowkow jest istotna: `x-forwarded-for`
 * jest lista, w ktorej pierwszy wpis to klient, a kolejne to proxy po drodze.
 * Na Vercelu platforma nadpisuje `x-forwarded-for` adresem klienta, wiec pierwszy
 * wpis jest wiarygodny; poza Vercelem naglowek jest podrabialny.
 */
export function getClientIp(request: RequestWithHeaders): string {
    const forwarded = request.headers.get('x-forwarded-for');

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    return request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || '127.0.0.1';
}

/** Ile 16-bitowych grup IPv6 tworzy prefiks /64, ktory dostaje jeden abonent. */
const IPV6_SUBNET_GROUPS = 4;
const IPV6_GROUP_COUNT = 8;
/** `::ffff:a.b.c.d` — piec zerowych grup i `ffff`. */
const IPV4_MAPPED_PREFIX = [0, 0, 0, 0, 0, 0xFF_FF];

/**
 * Podmiot limitu dla adresu klienta.
 *
 * Abonent IPv6 dostaje zwykle cala siec /64, wiec liczenie po pelnym adresie dawaloby
 * mu ~2^64 osobnych limitow. Adres IPv6 sprowadzamy do prefiksu /64, IPv4 i IPv4
 * zmapowany w IPv6 (`::ffff:1.2.3.4`) do czystego IPv4. Tekst, ktory nie jest
 * adresem IP, zostaje bez zmian.
 */
export function rateLimitSubject(ip: string): string {
    const candidate = ip.trim();
    if (isIPv4(candidate)) return candidate;
    if (!isIPv6(candidate)) return ip;

    const groups = expandIPv6(candidate.split('%')[0].toLowerCase());
    if (IPV4_MAPPED_PREFIX.every((group, index) => groups[index] === group)) {
        return ipv4FromGroups(groups[6], groups[7]);
    }

    const subnet = groups.slice(0, IPV6_SUBNET_GROUPS).map(group => group.toString(16));
    return `${subnet.join(':')}::/64`;
}

/** Osiem grup jako liczby; rozwija `::` i osadzony na koncu zapis IPv4. */
function expandIPv6(address: string): number[] {
    const [head, tail = ''] = address.split('::');
    const headGroups = parseIPv6Groups(head);
    const tailGroups = parseIPv6Groups(tail);
    const zeros = Array.from<number>({
        length: IPV6_GROUP_COUNT - headGroups.length - tailGroups.length,
    }).fill(0);

    return [...headGroups, ...zeros, ...tailGroups];
}

function parseIPv6Groups(part: string): number[] {
    if (part === '') return [];

    return part.split(':').flatMap(group => {
        if (!group.includes('.')) return [Number.parseInt(group, 16)];
        const [a, b, c, d] = group.split('.').map(octet => Number.parseInt(octet, 10));
        return [a * 256 + b, c * 256 + d];
    });
}

function ipv4FromGroups(high: number, low: number): string {
    return [high >> 8, high & 0xFF, low >> 8, low & 0xFF].join('.');
}

/** `TTL` dla klucza, ktory istnieje, ale nie ma czasu wygasniecia. */
const TTL_NOT_SET = -1;

/** Redis nie oddal liczb z transakcji limitu — zepsuty klucz albo przerwane `EXEC`. */
export class RateLimitStoreError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitStoreError';
    }
}

/**
 * Liczy zapytanie i mowi, czy miesci sie w limicie.
 *
 * TTL ustawiany jest WYLACZNIE przy pierwszym zapytaniu w oknie. Odswiezanie go
 * przy kazdym trafieniu zamienialoby okno przesuwne w blokade wieczna —
 * zablokowany klient odnawialby sobie kare kazda kolejna proba.
 */
export async function checkRateLimit({
    key,
    max,
    windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
    const { count, ttl } = await incrementInWindow(key, windowSeconds);

    // Samonaprawa klucza bez TTL zostawionego przez dawne nieatomowe INCR + EXPIRE.
    // Bez niej `add-business:gen:global` po 40 generowaniach blokowalby funkcje na zawsze.
    if (ttl === TTL_NOT_SET) {
        await redis.expire(key, windowSeconds);
    }

    if (count > max) {
        return { allowed: false, retryAfter: retryAfterFromTtl(ttl, windowSeconds) };
    }

    return { allowed: true, remaining: max - count };
}

/**
 * `SET key 0 EX okno NX` + `INCR` w jednym `MULTI`: klucz powstaje od razu z TTL,
 * wiec przerwanie miedzy komendami nie zostawi go bez wygasniecia. `NX` w `SET`
 * nie nadpisuje istniejacego licznika ani jego TTL, a `INCR` zachowuje TTL.
 * Dziala na kazdym Redisie (>= 2.6.12), w odroznieniu od `EXPIRE ... NX` (>= 7.0).
 */
async function incrementInWindow(
    key: string,
    windowSeconds: number,
): Promise<{ count: number; ttl: number }> {
    const results = await redis
        .multi()
        .set(key, '0', 'EX', windowSeconds, 'NX')
        .incr(key)
        .ttl(key)
        .exec();

    const count = results?.[1]?.[1];
    const ttl = results?.[2]?.[1];

    if (typeof count !== 'number' || typeof ttl !== 'number') {
        throw new RateLimitStoreError('Rate limit transaction returned no counter');
    }

    return { count, ttl };
}

/**
 * Mowi, czy KOLEJNE zapytanie zmiesciloby sie w limicie, nie liczac go.
 *
 * Czyta ten sam klucz co `checkRateLimit`, wiec oba widza jeden licznik. Sluzy do
 * sprawdzenia limitu przed kosztowna praca, ktora moze sie nie udac i wtedy nie
 * powinna go zuzywac (np. pobranie strony przed generowaniem). Nie jest rezerwacja:
 * miedzy `peek` a `checkRateLimit` inny klient moze zajac ostatnie miejsce — wiazaca
 * decyzje podejmuje zawsze `checkRateLimit`.
 */
export async function peekRateLimit({
    key,
    max,
    windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
    const raw = await redis.get(key);
    const count = raw === null ? 0 : Number.parseInt(raw, 10);

    if (count >= max) {
        return { allowed: false, retryAfter: await secondsUntilReset(key, windowSeconds) };
    }

    return { allowed: true, remaining: max - count };
}

async function secondsUntilReset(key: string, windowSeconds: number): Promise<number> {
    return retryAfterFromTtl(await redis.ttl(key), windowSeconds);
}

function retryAfterFromTtl(ttl: number, windowSeconds: number): number {
    // -1 (klucz bez TTL) i -2 (klucz zniknal miedzy odczytem a TTL) sa realne przy
    // wyscigu z wygasnieciem. `Retry-After: -1` to naglowek nie do uzycia.
    return ttl > 0 ? ttl : windowSeconds;
}
