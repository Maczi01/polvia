/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    FIXTURE_HTML,
    harness,
    IP,
    linkForm,
    SITE,
} from '../../../tests/fixtures/add-business/generate-draft-harness';
import { FETCH_BUDGET_MS, generateDraft } from './generate-draft';
import { FALLBACK_SUBPAGE_TIMEOUT_MS, SUBPAGE_TIMEOUT_MS } from './page-sources';

/** Jeden deadline na generowanie (review A, P2 #9) — zegar wstrzykniety przez `now()`. */

const mockRedis = createFakeRedis();

jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

beforeEach(() => {
    mockRedis.reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('generateDraft — budzet czasu', () => {
    it('strona glowna dostaje pelny timeout, zgadywana podstrona krotszy', async () => {
        const h = harness();

        await generateDraft({ formData: linkForm(SITE), ip: IP, locale: 'pl' }, h.deps);

        const timeouts = h.fetchHtml.mock.calls.map(([url, options]) => [url, options.timeoutMs]);
        expect(timeouts[0]).toEqual([SITE, 8000]);
        // Link na `/kontakt` ma sciezke zgadywanej podstrony, wiec dostaje jej krotszy limit.
        expect(timeouts.slice(1)).toEqual([
            ['https://gabinet-zdrowie.pl/kontakt', FALLBACK_SUBPAGE_TIMEOUT_MS],
            ['https://gabinet-zdrowie.pl/en/contact-us', SUBPAGE_TIMEOUT_MS],
        ]);
    });

    it('przy wyczerpanym budzecie podstrony nie sa pobierane, a szkic powstaje', async () => {
        const h = harness();
        h.fetchHtml.mockImplementationOnce(async () => {
            h.clock.now += FETCH_BUDGET_MS - 500;
            return { ok: true, finalUrl: SITE, mimeType: 'text/html', body: FIXTURE_HTML };
        });

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(h.fetchHtml).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('ready');
    });

    it('timeout podstrony jest przyciety do pozostalego budzetu', async () => {
        const h = harness();
        h.fetchHtml.mockImplementationOnce(async () => {
            h.clock.now += FETCH_BUDGET_MS - 1500;
            return { ok: true, finalUrl: SITE, mimeType: 'text/html', body: FIXTURE_HTML };
        });

        await generateDraft({ formData: linkForm(SITE), ip: IP, locale: 'pl' }, h.deps);

        const subpageTimeouts = h.fetchHtml.mock.calls
            .slice(1)
            .map(([, options]) => options.timeoutMs);
        expect(subpageTimeouts).toEqual([1500, 1500]);
    });
});
