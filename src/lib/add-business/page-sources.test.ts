/**
 * @jest-environment node
 */
import { MAX_TEXT_LENGTH } from '@/lib/add-business/html-extract';
import {
    type FetchHtml,
    MIN_FETCH_TIMEOUT_MS,
    type PageSourceDeps,
    readPageSource,
} from '@/lib/add-business/page-sources';
import type { SafeFetchResult } from '@/lib/add-business/safe-fetch';
import { PAGE_SOURCE_ERROR_TO_MANUAL } from '@/lib/add-business/types';

const SITE = 'https://firma.example.pl/';
const CONTACT = 'https://firma.example.pl/kontakt';

interface PageSpec {
    body: string;
    jsonLd?: Record<string, unknown>;
}

function html({ body, jsonLd }: PageSpec): string {
    const script =
        jsonLd === undefined
            ? ''
            : `<script type="application/ld+json">${JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  ...jsonLd,
              })}</script>`;
    return `<!doctype html><html><head>${script}</head><body>${body}</body></html>`;
}

function page(url: string, spec: PageSpec): SafeFetchResult<string> {
    return { ok: true, finalUrl: url, mimeType: 'text/html', body: html(spec) };
}

const CONTACT_LINK = `<a href="/kontakt">Kontakt</a>`;

/** Strona firmy to zewnetrzny serwis — fetch podmieniony na mape adres → odpowiedz. */
function fakeSite(
    pages: Record<string, SafeFetchResult<string> | Error>,
): jest.MockedFunction<FetchHtml> {
    return jest.fn<ReturnType<FetchHtml>, Parameters<FetchHtml>>(async url => {
        const response = pages[url];
        if (response === undefined) return { ok: false, code: 'HTTP_ERROR' };
        if (response instanceof Error) throw response;
        return response;
    });
}

function deps(fetchHtml: FetchHtml, fetchDeadline = 30_000): PageSourceDeps {
    return { fetchHtml, now: () => 0, fetchDeadline };
}

beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('readPageSource', () => {
    it('strona glowna z podstrona kontaktowa: tekst z obu i adres strony glownej', async () => {
        const fetchHtml = fakeSite({
            [SITE]: page(SITE, { body: `<h1>Pralnia Babel</h1>${CONTACT_LINK}` }),
            [CONTACT]: page(CONTACT, { body: '<p>Tel. 600 100 200</p>' }),
        });

        const result = await readPageSource(SITE, deps(fetchHtml));

        if (!result.ok) throw new Error(`oczekiwano ok, jest ${result.code}`);
        expect(result.source.url).toBe(SITE);
        expect(result.source.text).toContain('Pralnia Babel');
        expect(result.source.text).toContain('Tel. 600 100 200');
        expect(fetchHtml).toHaveBeenCalledWith(CONTACT, expect.anything());
    });

    it('niepoprawny adres koncowy strony glownej to wlasny kod, prowadzacy do trybu recznego', async () => {
        const fetchHtml = fakeSite({
            [SITE]: {
                ok: true,
                finalUrl: 'ftp://firma.example.pl/',
                mimeType: 'text/html',
                body: '',
            },
        });

        const result = await readPageSource(SITE, deps(fetchHtml));

        expect(result).toEqual({ ok: false, code: 'INVALID_FINAL_URL' });
        expect(result.ok || PAGE_SOURCE_ERROR_TO_MANUAL[result.code]).toBe('UNREADABLE');
    });

    it('blad pobrania strony glownej przechodzi dalej bez podstron', async () => {
        const fetchHtml = fakeSite({ [SITE]: { ok: false, code: 'BLOCKED_ADDRESS' } });

        const result = await readPageSource(SITE, deps(fetchHtml));

        expect(result).toEqual({ ok: false, code: 'BLOCKED_ADDRESS' });
        expect(fetchHtml).toHaveBeenCalledTimes(1);
    });

    it(`budzet ponizej ${MIN_FETCH_TIMEOUT_MS} ms daje TIMEOUT bez fetchu`, async () => {
        const fetchHtml = fakeSite({});

        const result = await readPageSource(SITE, deps(fetchHtml, MIN_FETCH_TIMEOUT_MS - 1));

        expect(result).toEqual({ ok: false, code: 'TIMEOUT' });
        expect(fetchHtml).not.toHaveBeenCalled();
    });

    it('strona glowna dostaje timeout z pozostalego budzetu', async () => {
        const fetchHtml = fakeSite({ [SITE]: page(SITE, { body: '<p>Firma</p>' }) });

        await readPageSource(SITE, deps(fetchHtml, 3000));

        expect(fetchHtml).toHaveBeenCalledWith(SITE, { timeoutMs: 3000 });
    });

    it('wyjatek przy podstronie nie psuje wyniku strony glownej', async () => {
        const fetchHtml = fakeSite({
            [SITE]: page(SITE, { body: `<p>Strona glowna</p>${CONTACT_LINK}` }),
            [CONTACT]: new Error('socket hang up'),
        });

        const result = await readPageSource(SITE, deps(fetchHtml));

        if (!result.ok) throw new Error(`oczekiwano ok, jest ${result.code}`);
        expect(result.source.text).toContain('Strona glowna');
    });

    it('JSON-LD strony glownej wygrywa z podstrona; brakujace pola uzupelnia podstrona', async () => {
        const fetchHtml = fakeSite({
            [SITE]: page(SITE, {
                body: CONTACT_LINK,
                jsonLd: { name: 'Pralnia Babel', telephone: '+48 600 100 200' },
            }),
            [CONTACT]: page(CONTACT, {
                body: '<p>Kontakt</p>',
                jsonLd: { name: 'Inna nazwa', telephone: '+48 111 111 111', email: 'b@example.pl' },
            }),
        });

        const result = await readPageSource(SITE, deps(fetchHtml));

        if (!result.ok) throw new Error(`oczekiwano ok, jest ${result.code}`);
        expect(result.source.structured).toEqual(
            expect.objectContaining({
                name: 'Pralnia Babel',
                telephone: '+48 600 100 200',
                email: 'b@example.pl',
            }),
        );
    });

    it('budzet tekstu: podstrona ma najwyzej cwierc, strona glowna reszte', async () => {
        const subpageLength = Math.floor(MAX_TEXT_LENGTH / 4);
        const fetchHtml = fakeSite({
            [SITE]: page(SITE, { body: `<p>${'a'.repeat(MAX_TEXT_LENGTH)}</p>${CONTACT_LINK}` }),
            [CONTACT]: page(CONTACT, { body: `<p>${'b'.repeat(MAX_TEXT_LENGTH)}</p>` }),
        });

        const result = await readPageSource(SITE, deps(fetchHtml));

        if (!result.ok) throw new Error(`oczekiwano ok, jest ${result.code}`);
        const [mainText, subText] = result.source.text.split('\n\n');
        expect(subText).toBe('b'.repeat(subpageLength));
        expect(mainText).toBe('a'.repeat(MAX_TEXT_LENGTH - subpageLength));
    });
});
