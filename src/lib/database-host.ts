/**
 * Rozpoznanie, czy `DATABASE_URL` wskazuje na baze lokalna (docker-compose), czy zdalna.
 *
 * Wspolne dla bramek chroniacych zdalna (produkcyjna) baze: `db:drop` (kasowanie) oraz zapisu
 * stanu premium przy testowym kluczu Stripe (webhook, `db:sync-subscriptions`).
 * Bez `server-only` i bez zaleznosci — importuja go tez skrypty CLI z `src/db`.
 *
 * Ograniczenie: bramka chroni przed blednym `DATABASE_URL` (adres zdalnej bazy w zmiennej),
 * NIE przed tunelem na localhost (`ssh -L`, `cloud-sql-proxy`) — zdalna baza wystawiona pod
 * `localhost` jest stad nieodroznialna od lokalnego docker-compose.
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

/** Host bazy z jednego parsowania adresu: do logu (`hostname`) i do bramek (`isLocal`). */
export type DatabaseHost = {
    /** `null`, gdy adresu nie da sie przeparsowac. */
    hostname: string | null;
    /** Niepoprawny albo pusty adres traktujemy jak zdalny — bezpieczniej odmowic. */
    isLocal: boolean;
};

export function inspectDatabaseUrl(databaseUrl: string): DatabaseHost {
    const hostname = databaseHostname(databaseUrl);
    return { hostname, isLocal: hostname !== null && LOCAL_HOSTS.has(hostname) };
}

/** Niepoprawny albo pusty adres traktujemy jak zdalny — bezpieczniej odmowic. */
export function isLocalDatabaseUrl(databaseUrl: string): boolean {
    return inspectDatabaseUrl(databaseUrl).isLocal;
}
