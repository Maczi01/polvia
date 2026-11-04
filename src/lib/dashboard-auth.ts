import { locales } from '../i18n/config';

/**
 * Bramka panelu `/dashboard` (HTTP Basic Auth). Czysty modul bez zoda/drizzle/Node API:
 * laduje go middleware (edge) i serwerowy guard akcji (`dashboard-access.ts`).
 */

export type DashboardCredentials = {
    user: string;
    password: string;
};

type DashboardEnv = {
    DASHBOARD_USER?: string;
    DASHBOARD_PASSWORD?: string;
};

const DASHBOARD_SEGMENT = 'dashboard';
const BASIC_SCHEME = 'basic ';
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64_BLOCK = 4;
const LOCALE_SET: ReadonlySet<string> = new Set(locales);

/**
 * Dane logowania albo `null` = panel wylaczony. Fail-closed: brak ktorejkolwiek zmiennej
 * wylacza panel (middleware zwraca 404), zamiast go otwierac.
 */
export function resolveDashboardCredentials(env: DashboardEnv): DashboardCredentials | null {
    if (!env.DASHBOARD_USER || !env.DASHBOARD_PASSWORD) return null;
    return { user: env.DASHBOARD_USER, password: env.DASHBOARD_PASSWORD };
}

function decodePathname(pathname: string): string | null {
    try {
        return decodeURIComponent(pathname);
    } catch (error) {
        if (error instanceof URIError) return null;
        throw error;
    }
}

/**
 * Czy sciezka nalezy do panelu: `/dashboard/**` i `/{locale}/dashboard/**`.
 * Porownanie po zdekodowaniu i bez wielkosci liter, zeby `/Dashboard` czy `/dash%62oard`
 * nie ominely bramki. Niepoprawne kodowanie traktujemy jak panel (fail-closed).
 */
export function isDashboardPathname(pathname: string): boolean {
    const decoded = decodePathname(pathname);
    if (decoded === null) return true;

    const segments = decoded.toLowerCase().split('/').filter(Boolean);
    const [first, second] = segments;
    return (LOCALE_SET.has(first) ? second : first) === DASHBOARD_SEGMENT;
}

/** Porownanie w czasie niezaleznym od miejsca pierwszej roznicy (bez Node `crypto` — edge). */
function constantTimeEqual(actual: string, expected: string): boolean {
    const encoder = new TextEncoder();
    const a = encoder.encode(actual);
    const b = encoder.encode(expected);
    let diff = a.length ^ b.length;
    for (const [index, byte] of b.entries()) {
        diff |= (a[index] ?? 0) ^ byte;
    }
    return diff === 0;
}

function decodeBasicToken(authorization: string): string | null {
    if (!authorization.toLowerCase().startsWith(BASIC_SCHEME)) return null;
    const token = authorization.slice(BASIC_SCHEME.length).trim();
    if (!BASE64_PATTERN.test(token) || token.length % BASE64_BLOCK !== 0) return null;
    return atob(token);
}

/**
 * Czy naglowek `Authorization` niesie poprawne dane panelu. Haslo ASCII (np. `openssl rand -hex 32`):
 * `atob` dekoduje do Latin-1, wiec znaki spoza ASCII nie przejda.
 */
export function isAuthorizedDashboardRequest(
    authorization: string | null,
    credentials: DashboardCredentials,
): boolean {
    if (!authorization) return false;
    const decoded = decodeBasicToken(authorization);
    if (decoded === null) return false;

    const separator = decoded.indexOf(':');
    if (separator === -1) return false;

    // Oba porownania zawsze — bez skrotu, ktory zdradzalby poprawny login czasem odpowiedzi.
    const isUserValid = constantTimeEqual(decoded.slice(0, separator), credentials.user);
    const isPasswordValid = constantTimeEqual(decoded.slice(separator + 1), credentials.password);
    return isUserValid && isPasswordValid;
}

export const DASHBOARD_AUTH_CHALLENGE = 'Basic realm="polvia-dashboard", charset="UTF-8"';
