/**
 * Minimalna atrapa Redisa w pamieci dla testow modulow `add-business`.
 *
 * Redis to zewnetrzny serwis, wiec wolno go zastapic. Atrapa implementuje tylko
 * komendy, ktorych uzywaja `rate-limit.ts` i `draft-store.ts`, z semantyka TTL
 * na wirtualnym zegarze (`advance`), zeby testy nie czekaly na prawdziwy czas.
 */

interface Entry {
    value: string;
    /** Moment wygasniecia w sekundach wirtualnego zegara; `null` = bez TTL. */
    expiresAt: number | null;
}

export interface FakeRedis {
    get(key: string): Promise<string | null>;
    getdel(key: string): Promise<string | null>;
    set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null>;
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    /** Pomocnicze: przesuwa wirtualny zegar. */
    advance(seconds: number): void;
    /** Pomocnicze: wpisuje surowa wartosc z pominieciem logiki aplikacji. */
    seed(key: string, value: string, ttlSeconds?: number): void;
    reset(): void;
}

export function createFakeRedis(): FakeRedis {
    const store = new Map<string, Entry>();
    let now = 0;

    function live(key: string): Entry | undefined {
        const entry = store.get(key);
        if (entry && entry.expiresAt !== null && entry.expiresAt <= now) {
            store.delete(key);
            return undefined;
        }
        return entry;
    }

    return {
        async get(key) {
            return live(key)?.value ?? null;
        },
        async getdel(key) {
            const entry = live(key);
            store.delete(key);
            return entry?.value ?? null;
        },
        async set(key, value, ...args) {
            const flags = args.map(String);
            const existing = live(key);
            if (flags.includes('XX') && !existing) return null;
            if (flags.includes('NX') && existing) return null;

            const exIndex = flags.indexOf('EX');
            let expiresAt: number | null = null;
            if (exIndex !== -1) expiresAt = now + Number(flags[exIndex + 1]);
            if (flags.includes('KEEPTTL')) expiresAt = existing?.expiresAt ?? null;

            store.set(key, { value, expiresAt });
            return 'OK';
        },
        async incr(key) {
            const entry = live(key);
            const next = (entry ? Number(entry.value) : 0) + 1;
            store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
            return next;
        },
        async expire(key, seconds) {
            const entry = live(key);
            if (!entry) return 0;
            entry.expiresAt = now + seconds;
            return 1;
        },
        async ttl(key) {
            const entry = live(key);
            if (!entry) return -2;
            if (entry.expiresAt === null) return -1;
            return entry.expiresAt - now;
        },
        advance(seconds) {
            now += seconds;
        },
        seed(key, value, ttlSeconds) {
            store.set(key, {
                value,
                expiresAt: ttlSeconds === undefined ? null : now + ttlSeconds,
            });
        },
        reset() {
            store.clear();
            now = 0;
        },
    };
}
