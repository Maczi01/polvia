import 'server-only';

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
 */
export function getClientIp(request: RequestWithHeaders): string {
    const forwarded = request.headers.get('x-forwarded-for');

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    return request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || '127.0.0.1';
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
    const count = await redis.incr(key);

    if (count === 1) {
        await redis.expire(key, windowSeconds);
    }

    if (count > max) {
        return { allowed: false, retryAfter: await secondsUntilReset(key, windowSeconds) };
    }

    return { allowed: true, remaining: max - count };
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
    const ttl = await redis.ttl(key);

    // -1 (klucz bez TTL) i -2 (klucz zniknal miedzy INCR a TTL) sa realne przy
    // wyscigu z wygasnieciem. `Retry-After: -1` to naglowek nie do uzycia.
    return ttl > 0 ? ttl : windowSeconds;
}
