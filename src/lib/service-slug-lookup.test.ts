/**
 * @jest-environment node
 */
// fetch, Response i AbortSignal.timeout z Node — jsdom ich nie ma.
import {
    lookupServiceSlug,
    SERVICE_SLUG_LOOKUP_SECRET_HEADER,
    SERVICE_SLUG_LOOKUP_TIMEOUT_MS,
} from './service-slug-lookup';

const SECRET = 'a'.repeat(64);
const OPTIONS = { origin: 'https://www.polvia.pl', slug: 'kancelaria-nowak', secret: SECRET };

// Route handler za `fetch` to zewnetrzna (dla middleware) usluga HTTP.
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('lookupServiceSlug', () => {
    it('exists: true daje found; pyta handler tej samej aplikacji z sekretem', async () => {
        fetchMock.mockResolvedValue(json({ data: { exists: true }, error: null }));

        expect(await lookupServiceSlug(OPTIONS)).toBe('found');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://www.polvia.pl/api/service-slug/kancelaria-nowak');
        expect(new Headers(init?.headers).get(SERVICE_SLUG_LOOKUP_SECRET_HEADER)).toBe(SECRET);
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('nie wylacza cache HTTP — powtorzony slug moze obsluzyc CDN', async () => {
        fetchMock.mockResolvedValue(json({ data: { exists: true }, error: null }));

        await lookupServiceSlug(OPTIONS);

        expect(fetchMock.mock.calls[0][1]?.cache).toBeUndefined();
    });

    it('exists: false daje missing', async () => {
        fetchMock.mockResolvedValue(json({ data: { exists: false }, error: null }));

        expect(await lookupServiceSlug(OPTIONS)).toBe('missing');
    });

    it('nie przekazuje x-forwarded-for — limit zaufanego ruchu nie zalezy od IP', async () => {
        fetchMock.mockResolvedValue(json({ data: { exists: true }, error: null }));

        await lookupServiceSlug(OPTIONS);

        expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('x-forwarded-for')).toBe(false);
    });

    it.each([429, 500, 503])('status %i daje unknown (fail-open)', async status => {
        fetchMock.mockResolvedValue(json({ data: null, error: { code: 'X', message: 'x' } }, status));

        expect(await lookupServiceSlug(OPTIONS)).toBe('unknown');
    });

    it('odpowiedz w zlym ksztalcie daje unknown', async () => {
        fetchMock.mockResolvedValue(json({ exists: true }));

        expect(await lookupServiceSlug(OPTIONS)).toBe('unknown');
    });

    it('blad sieci daje unknown i jest logowany', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'));

        expect(await lookupServiceSlug(OPTIONS)).toBe('unknown');
        expect(console.error).toHaveBeenCalled();
    });

    it('zawieszony handler konczy sie po timeoucie wynikiem unknown', async () => {
        // Handler, ktory nie odpowiada, dopoki sygnal nie przerwie zapytania.
        fetchMock.mockImplementation(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
                }),
        );
        const started = Date.now();

        expect(await lookupServiceSlug(OPTIONS)).toBe('unknown');
        expect(Date.now() - started).toBeGreaterThanOrEqual(SERVICE_SLUG_LOOKUP_TIMEOUT_MS - 50);
    });
});
