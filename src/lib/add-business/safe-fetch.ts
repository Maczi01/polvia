import 'server-only';

import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

import { isPublicUnicastAddress } from '@/lib/add-business/public-address';

/**
 * Pobieranie strony z linku podanego przez uzytkownika (R17).
 *
 * Link jest niezaufany, wiec bez tej bramki serwer pobralby za atakujacego zasob
 * wewnetrzny (np. metadane chmury pod 169.254.169.254). Adres jest sprawdzany w
 * chwili polaczenia — w `lookup` przekazanym do gniazda — a nie przed nim, bo
 * osobne sprawdzenie DNS dawaloby okno na DNS rebinding.
 *
 * Transport i resolver przychodza z zewnatrz, zeby testy nie dotykaly sieci.
 */

export type SafeFetchErrorCode =
    | 'INVALID_URL'
    | 'BLOCKED_ADDRESS'
    | 'TIMEOUT'
    | 'TOO_LARGE'
    | 'BAD_CONTENT_TYPE'
    | 'HTTP_ERROR'
    | 'TOO_MANY_REDIRECTS'
    | 'NETWORK_ERROR';

export type SafeFetchResult<TBody> =
    | { ok: true; finalUrl: string; mimeType: string; body: TBody }
    | { ok: false; code: SafeFetchErrorCode };

export const HTML_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 1024 * 1024;
/** Limit na cala operacje, razem z redirectami i czytaniem body (slowloris). */
export const SAFE_FETCH_TIMEOUT_MS = 8000;
export const MAX_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_MIME_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const USER_AGENT = 'PolviaBot/1.0 (+https://polvia.pl)';

export type ResolvedAddress = { address: string; family: number };
export type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

export type TransportRequest = { url: URL; signal: AbortSignal; lookup: LookupFunction };
export type TransportResponse = {
    status: number;
    location: string | null;
    contentType: string | null;
    body: AsyncIterable<Uint8Array>;
    /** Zamyka polaczenie bez czytania reszty body. */
    discard(): void;
};
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

export type SafeFetchOptions = {
    transport?: Transport;
    resolveHost?: ResolveHost;
    timeoutMs?: number;
};

export class BlockedAddressError extends Error {
    constructor(readonly hostname: string) {
        super(`Host ${hostname} wskazuje na adres niepubliczny`);
        this.name = 'BlockedAddressError';
    }
}

// --- Walidacja URL ---------------------------------------------------------------

type ParsedUrl = { ok: true; url: URL } | { ok: false; code: SafeFetchErrorCode };

function parseSafeUrl(raw: string, base?: URL): ParsedUrl {
    if (!URL.canParse(raw, base)) return { ok: false, code: 'INVALID_URL' };

    const url = new URL(raw, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { ok: false, code: 'INVALID_URL' };
    }
    if (url.username !== '' || url.password !== '') return { ok: false, code: 'INVALID_URL' };
    // WHATWG URL zeruje port domyslny dla schematu, wiec niepusty = niestandardowy.
    if (url.port !== '') return { ok: false, code: 'INVALID_URL' };

    // Dla literalu IP gniazdo nie wola `lookup`, wiec to jedyne miejsce kontroli.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) !== 0 && !isPublicUnicastAddress(host)) {
        return { ok: false, code: 'BLOCKED_ADDRESS' };
    }
    return { ok: true, url };
}

// --- Polaczenie ------------------------------------------------------------------

const defaultResolveHost: ResolveHost = hostname =>
    dnsLookup(hostname, { all: true, verbatim: true });

/**
 * `lookup` dla gniazda: odrzuca host, gdy KTORYKOLWIEK z rozwiazanych adresow jest
 * niepubliczny — mieszany zestaw to typowa sztuczka przy rebindingu.
 */
function createGuardedLookup(resolveHost: ResolveHost): LookupFunction {
    return (hostname, options, callback) => {
        resolveHost(hostname).then(
            addresses => {
                if (addresses.length === 0) {
                    callback(new Error(`Brak adresow dla ${hostname}`), '');
                    return;
                }
                if (!addresses.every(({ address }) => isPublicUnicastAddress(address))) {
                    callback(new BlockedAddressError(hostname), '');
                    return;
                }
                const family = options.family === 4 || options.family === 6 ? options.family : 0;
                const usable = addresses.filter(a => family === 0 || a.family === family);
                const [first] = usable;
                if (!first) {
                    callback(new Error(`Brak adresow IPv${family} dla ${hostname}`), '');
                    return;
                }
                if (options.all) callback(null, usable);
                else callback(null, first.address, first.family);
            },
            (error: unknown) => {
                callback(error instanceof Error ? error : new Error(String(error)), '');
            },
        );
    };
}

const defaultTransport: Transport = ({ url, signal, lookup }) =>
    new Promise((resolve, reject) => {
        const client = url.protocol === 'https:' ? https : http;
        const request = client.request(
            url,
            {
                method: 'GET',
                agent: false,
                lookup,
                signal,
                // Bez Accept-Encoding serwer odda body bez kompresji — limit bajtow
                // dotyczy wtedy tego, co faktycznie trafia do pamieci.
                headers: {
                    accept: 'text/html,application/xhtml+xml,image/*',
                    'user-agent': USER_AGENT,
                },
            },
            response => {
                resolve({
                    status: response.statusCode ?? 0,
                    location: response.headers.location ?? null,
                    contentType: response.headers['content-type'] ?? null,
                    body: response,
                    discard: () => response.destroy(),
                });
            },
        );
        request.on('error', reject);
        request.end();
    });

// --- Rdzen -----------------------------------------------------------------------

type Policy = { maxBytes: number; acceptsMimeType(mimeType: string): boolean };
type FetchedBytes = { finalUrl: string; mimeType: string; charset: string | null; bytes: Buffer };
type CoreResult = { ok: true; value: FetchedBytes } | { ok: false; code: SafeFetchErrorCode };

function parseContentType(header: string | null): { mimeType: string; charset: string | null } {
    const [mimeType = ''] = (header ?? '').split(';');
    const charset = /charset\s*=\s*"?([^";\s]+)/i.exec(header ?? '')?.[1] ?? null;
    return { mimeType: mimeType.trim().toLowerCase(), charset };
}

async function readResponse(
    response: TransportResponse,
    url: URL,
    policy: Policy,
): Promise<CoreResult> {
    if (response.status < 200 || response.status > 299) {
        response.discard();
        return { ok: false, code: 'HTTP_ERROR' };
    }
    const { mimeType, charset } = parseContentType(response.contentType);
    if (!policy.acceptsMimeType(mimeType)) {
        response.discard();
        return { ok: false, code: 'BAD_CONTENT_TYPE' };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of response.body) {
        total += chunk.byteLength;
        if (total > policy.maxBytes) {
            response.discard();
            return { ok: false, code: 'TOO_LARGE' };
        }
        chunks.push(chunk);
    }
    return {
        ok: true,
        value: { finalUrl: url.href, mimeType, charset, bytes: Buffer.concat(chunks, total) },
    };
}

function classifyFailure(error: unknown, signal: AbortSignal): SafeFetchErrorCode {
    if (error instanceof BlockedAddressError) return 'BLOCKED_ADDRESS';
    if (signal.aborted) return 'TIMEOUT';
    return 'NETWORK_ERROR';
}

async function fetchWithGuards(
    rawUrl: string,
    policy: Policy,
    options: SafeFetchOptions,
): Promise<CoreResult> {
    const parsed = parseSafeUrl(rawUrl);
    if (!parsed.ok) return parsed;

    const transport = options.transport ?? defaultTransport;
    const lookup = createGuardedLookup(options.resolveHost ?? defaultResolveHost);
    const signal = AbortSignal.timeout(options.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS);
    let url = parsed.url;

    try {
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const response = await transport({ url, signal, lookup });
            if (!REDIRECT_STATUSES.has(response.status)) {
                return await readResponse(response, url, policy);
            }
            response.discard();
            if (response.location === null) return { ok: false, code: 'HTTP_ERROR' };

            const next = parseSafeUrl(response.location, url);
            if (!next.ok) return next;
            url = next.url;
        }
        return { ok: false, code: 'TOO_MANY_REDIRECTS' };
    } catch (error) {
        const code = classifyFailure(error, signal);
        // Szczegoly tylko w logu serwera — klient dostaje sam kod.
        console.warn('safe-fetch failed', {
            code,
            host: url.hostname,
            reason: error instanceof Error ? error.message : String(error),
        });
        return { ok: false, code };
    }
}

function decodeText(bytes: Buffer, charset: string | null): string {
    try {
        return new TextDecoder(charset ?? 'utf8').decode(bytes);
    } catch (error) {
        // Nieznana etykieta kodowania w naglowku — strona i tak najczesciej jest w UTF-8.
        if (error instanceof RangeError) return new TextDecoder().decode(bytes);
        throw error;
    }
}

// --- API -------------------------------------------------------------------------

/** Pobiera strone HTML (`text/html`, `application/xhtml+xml`) do `HTML_MAX_BYTES`. */
export async function safeFetchHtml(
    url: string,
    options: SafeFetchOptions = {},
): Promise<SafeFetchResult<string>> {
    const result = await fetchWithGuards(
        url,
        { maxBytes: HTML_MAX_BYTES, acceptsMimeType: mime => HTML_MIME_TYPES.has(mime) },
        options,
    );
    if (!result.ok) return result;

    const { finalUrl, mimeType, charset, bytes } = result.value;
    return { ok: true, finalUrl, mimeType, body: decodeText(bytes, charset) };
}

/** Pobiera obrazek (`image/*`) do `IMAGE_MAX_BYTES` jako surowe bajty. */
export async function safeFetchImage(
    url: string,
    options: SafeFetchOptions = {},
): Promise<SafeFetchResult<Uint8Array>> {
    const result = await fetchWithGuards(
        url,
        { maxBytes: IMAGE_MAX_BYTES, acceptsMimeType: mime => mime.startsWith('image/') },
        options,
    );
    if (!result.ok) return result;

    const { finalUrl, mimeType, bytes } = result.value;
    return { ok: true, finalUrl, mimeType, body: bytes };
}
