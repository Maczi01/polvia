import { normalizeHost } from '@/lib/add-business/link-kind';

/**
 * Dopasowanie wpisu katalogu po domenie strony (R7) — czesc bez bazy.
 *
 * `findServiceByDomain` zaweza kandydatow w SQL przez `ILIKE '%host%'`, ale to tylko
 * filtr wstepny: `abc.pl` pasuje tez do `xabc.pl` i do `abc.pl.example.com`.
 * Rozstrzyga dokladne porownanie znormalizowanych hostow tutaj.
 */

const SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/** Escapuje znaki specjalne `LIKE` (domyslny znak ucieczki Postgresa to `\`). */
export function escapeLikePattern(value: string): string {
    return value.replaceAll(/[\\%_]/g, character => `\\${character}`);
}

/**
 * Host z kolumny `webpage`. Wpisy z `data/services/` maja pelny URL, ale starsze
 * wiersze z dashboardu bywaja zapisane bez schematu (`firma.pl/kontakt`).
 */
export function hostOfWebpage(webpage: string): string | null {
    const trimmed = webpage.trim();
    const candidate = SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!URL.canParse(candidate)) return null;

    const host = normalizeHost(new URL(candidate).hostname);
    return host === '' ? null : host;
}

/** Pierwszy wiersz, ktorego strona ma dokladnie ten host (po normalizacji). */
export function pickByHost<Row extends { webpage: string | null }>(
    rows: readonly Row[],
    host: string,
): Row | null {
    const wanted = normalizeHost(host);
    return rows.find(row => row.webpage !== null && hostOfWebpage(row.webpage) === wanted) ?? null;
}
