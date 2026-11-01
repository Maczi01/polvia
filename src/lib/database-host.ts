/**
 * Rozpoznanie, czy `DATABASE_URL` wskazuje na baze lokalna (docker-compose), czy zdalna.
 *
 * Wspolne dla bramek chroniacych zdalna (produkcyjna) baze: `db:drop` (kasowanie) oraz zapisu
 * stanu premium przy testowym kluczu Stripe (webhook, `db:sync-subscriptions`).
 * Bez `server-only` i bez zaleznosci — importuja go tez skrypty CLI z `src/db`.
 */

const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/**
 * Sama nazwa hosta (bez loginu, hasla i portu) — bezpieczna do logu. `null`, gdy adresu nie
 * da sie przeparsowac. Schemat `postgres:` nie jest „specjalny” dla WHATWG URL, wiec parser
 * nie zmienia wielkosci liter i zostawia nawiasy wokol IPv6 — normalizujemy oba.
 */
export function databaseHostname(databaseUrl: string): string | null {
    let hostname: string;
    try {
        hostname = new URL(databaseUrl).hostname;
    } catch {
        // Bez tresci bledu: komunikat moze zawierac caly adres razem z haslem.
        return null;
    }
    return hostname.replace(/^\[(.*)]$/, '$1').toLowerCase();
}

/** Niepoprawny albo pusty adres traktujemy jak zdalny — bezpieczniej odmowic. */
export function isLocalDatabaseUrl(databaseUrl: string): boolean {
    const hostname = databaseHostname(databaseUrl);
    return hostname !== null && LOCAL_HOSTS.has(hostname);
}
