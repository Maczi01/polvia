/**
 * @jest-environment node
 */
import type { LookupFunction } from 'node:net';

import {
    HTML_MAX_BYTES,
    type ResolveHost,
    safeFetchHtml,
    safeFetchImage,
    type SafeFetchOptions,
    type Transport,
} from '@/lib/add-business/safe-fetch';

type FakeRoute = {
    status?: number;
    location?: string;
    contentType?: string;
    chunks?: Uint8Array[];
};

const PUBLIC_IP = '93.184.216.34';

function fakeDns(table: Record<string, string[]>): ResolveHost {
    return async hostname =>
        (table[hostname] ?? []).map(address => ({
            address,
            family: address.includes(':') ? 6 : 4,
        }));
}

/** Tak jak gniazdo: przed polaczeniem wola `lookup`, a jego blad konczy zadanie. */
function connect(lookup: LookupFunction, hostname: string): Promise<void> {
    return new Promise((resolve, reject) => {
        lookup(hostname, { all: true }, error => (error ? reject(error) : resolve()));
    });
}

/** Serwer, ktory milczy, az klient sie podda. */
function untilAborted(signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
    });
}

async function* toStream(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
    for (const chunk of chunks) yield chunk;
}

/** Siec w pamieci: trasy po pelnym URL-u, DNS ze slownika. Zero prawdziwych polaczen. */
function fakeNetwork(
    routes: Record<string, FakeRoute>,
    dns: Record<string, string[]> = {},
): SafeFetchOptions & { discard: jest.Mock; requested: string[] } {
    const discard = jest.fn();
    const requested: string[] = [];
    const transport: Transport = async ({ url, lookup }) => {
        await connect(lookup, url.hostname);
        requested.push(url.href);
        const route = routes[url.href];
        if (!route) throw new Error('ECONNREFUSED');
        return {
            status: route.status ?? 200,
            location: route.location ?? null,
            contentType: route.contentType ?? 'text/html; charset=utf-8',
            body: toStream(route.chunks ?? [new TextEncoder().encode('<html>ok</html>')]),
            discard,
        };
    };
    const hosts = Object.keys(routes).map(href => new URL(href).hostname);
    const table = Object.fromEntries(hosts.map(host => [host, [PUBLIC_IP]]));
    return { transport, resolveHost: fakeDns({ ...table, ...dns }), discard, requested };
}

describe('safeFetchHtml — walidacja URL', () => {
    it.each([
        'file:///etc/passwd',
        'ftp://example.com/',
        'javascript:alert(1)',
        'https://user:pass@example.com/',
        'https://example.com:22/',
        'http://example.com:8080/',
        'nie jest url',
    ])('odrzuca %s jako INVALID_URL bez polaczenia', async url => {
        const network = fakeNetwork({});

        const result = await safeFetchHtml(url, network);

        expect(result).toEqual({ ok: false, code: 'INVALID_URL' });
        expect(network.requested).toEqual([]);
    });

    it.each([
        'http://127.0.0.1/',
        'http://[::1]/',
        'http://169.254.169.254/latest',
        'http://2130706433/',
    ])('odrzuca literal IP %s jako BLOCKED_ADDRESS', async url => {
        const result = await safeFetchHtml(url, fakeNetwork({}));

        expect(result).toEqual({ ok: false, code: 'BLOCKED_ADDRESS' });
    });

    it('akceptuje jawny port domyslny dla schematu', async () => {
        const network = fakeNetwork({ 'https://firma.pl/': {} });

        const result = await safeFetchHtml('https://firma.pl:443/', network);

        expect(result.ok).toBe(true);
    });
});

describe('safeFetchHtml — adresy w chwili polaczenia', () => {
    it('blokuje host, ktory DNS rozwiazuje na adres prywatny', async () => {
        const network = fakeNetwork(
            { 'https://intranet.firma.pl/': {} },
            {
                'intranet.firma.pl': ['10.0.0.5'],
            },
        );

        const result = await safeFetchHtml('https://intranet.firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'BLOCKED_ADDRESS' });
        expect(network.requested).toEqual([]);
    });

    it('blokuje host z mieszanym zestawem adresow publiczny + prywatny', async () => {
        const network = fakeNetwork(
            { 'https://firma.pl/': {} },
            {
                'firma.pl': [PUBLIC_IP, '127.0.0.1'],
            },
        );

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'BLOCKED_ADDRESS' });
    });

    it('domyslny transport Node wola zabezpieczony lookup przed otwarciem gniazda', async () => {
        const resolveHost = jest.fn(fakeDns({ 'sklep.test': ['127.0.0.1'] }));

        const result = await safeFetchHtml('http://sklep.test/', { resolveHost });

        expect(result).toEqual({ ok: false, code: 'BLOCKED_ADDRESS' });
        expect(resolveHost).toHaveBeenCalledWith('sklep.test');
    });
});

describe('safeFetchHtml — redirecty', () => {
    it('blokuje redirect na adres prywatny', async () => {
        const network = fakeNetwork({
            'https://firma.pl/': {
                status: 302,
                location: 'http://169.254.169.254/latest/meta-data',
            },
        });

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'BLOCKED_ADDRESS' });
    });

    it('blokuje redirect na host rozwiazywany na adres prywatny', async () => {
        const network = fakeNetwork(
            {
                'https://firma.pl/': { status: 301, location: 'https://wewn.firma.pl/' },
                'https://wewn.firma.pl/': {},
            },
            { 'wewn.firma.pl': ['192.168.1.1'] },
        );

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'BLOCKED_ADDRESS' });
    });

    it('cztery redirecty to TOO_MANY_REDIRECTS', async () => {
        const network = fakeNetwork({
            'https://a.pl/': { status: 301, location: 'https://b.pl/' },
            'https://b.pl/': { status: 302, location: 'https://c.pl/' },
            'https://c.pl/': { status: 307, location: 'https://d.pl/' },
            'https://d.pl/': { status: 308, location: 'https://e.pl/' },
            'https://e.pl/': {},
        });

        const result = await safeFetchHtml('https://a.pl/', network);

        expect(result).toEqual({ ok: false, code: 'TOO_MANY_REDIRECTS' });
        expect(network.requested).not.toContain('https://e.pl/');
    });

    it('happy path: 200 text/html po redirectcie zwraca finalUrl i tresc', async () => {
        const network = fakeNetwork({
            'http://firma.pl/': { status: 301, location: '/start' },
            'http://firma.pl/start': { status: 302, location: 'https://www.firma.pl/o-nas' },
            'https://www.firma.pl/o-nas': {
                contentType: 'text/html; charset=UTF-8',
                chunks: [new TextEncoder().encode('<h1>Zażółć'), new TextEncoder().encode('</h1>')],
            },
        });

        const result = await safeFetchHtml('http://firma.pl/', network);

        expect(result).toEqual({
            ok: true,
            finalUrl: 'https://www.firma.pl/o-nas',
            mimeType: 'text/html',
            body: '<h1>Zażółć</h1>',
        });
    });

    it('redirect bez naglowka Location to HTTP_ERROR', async () => {
        const network = fakeNetwork({ 'https://firma.pl/': { status: 302 } });

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'HTTP_ERROR' });
    });
});

describe('safeFetchHtml — odpowiedz', () => {
    it('odpowiedz wieksza niz limit to TOO_LARGE i zamyka polaczenie', async () => {
        const half = new Uint8Array(HTML_MAX_BYTES / 2 + 1);
        const network = fakeNetwork({ 'https://firma.pl/': { chunks: [half, half] } });

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'TOO_LARGE' });
        expect(network.discard).toHaveBeenCalled();
    });

    it('application/pdf to BAD_CONTENT_TYPE', async () => {
        const network = fakeNetwork({ 'https://firma.pl/': { contentType: 'application/pdf' } });

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'BAD_CONTENT_TYPE' });
    });

    it('status 404 to HTTP_ERROR', async () => {
        const network = fakeNetwork({ 'https://firma.pl/': { status: 404 } });

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'HTTP_ERROR' });
    });

    const SLOW = { resolveHost: fakeDns({ 'firma.pl': [PUBLIC_IP] }), timeoutMs: 20 };

    it('brak odpowiedzi w czasie to TIMEOUT', async () => {
        const hanging: Transport = ({ signal }) => untilAborted(signal);

        const result = await safeFetchHtml('https://firma.pl/', { ...SLOW, transport: hanging });

        expect(result).toEqual({ ok: false, code: 'TIMEOUT' });
    });

    it('body saczace sie dluzej niz limit czasu to TIMEOUT', async () => {
        const stalling: Transport = async ({ signal }) => ({
            status: 200,
            location: null,
            contentType: 'text/html',
            discard: jest.fn(),
            body: (async function* () {
                yield new TextEncoder().encode('<html>');
                await untilAborted(signal);
            })(),
        });

        const result = await safeFetchHtml('https://firma.pl/', { ...SLOW, transport: stalling });

        expect(result).toEqual({ ok: false, code: 'TIMEOUT' });
    });

    it('blad polaczenia to NETWORK_ERROR', async () => {
        const network = fakeNetwork({}, { 'firma.pl': [PUBLIC_IP] });

        const result = await safeFetchHtml('https://firma.pl/', network);

        expect(result).toEqual({ ok: false, code: 'NETWORK_ERROR' });
    });
});

describe('safeFetchImage', () => {
    it('zwraca bajty obrazka image/png', async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);
        const network = fakeNetwork({
            'https://firma.pl/logo.png': { contentType: 'image/png', chunks: [bytes] },
        });

        const result = await safeFetchImage('https://firma.pl/logo.png', network);

        expect(result.ok && Array.from(result.body)).toEqual([137, 80, 78, 71]);
        expect(result.ok && result.mimeType).toBe('image/png');
    });

    it('odrzuca text/html jako BAD_CONTENT_TYPE', async () => {
        const network = fakeNetwork({ 'https://firma.pl/logo.png': {} });

        const result = await safeFetchImage('https://firma.pl/logo.png', network);

        expect(result).toEqual({ ok: false, code: 'BAD_CONTENT_TYPE' });
    });
});
