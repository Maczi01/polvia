/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    harness,
    IP,
    linkForm,
    manualForm,
    SITE,
} from '../../../tests/fixtures/add-business/generate-draft-harness';
import { getDraft } from './draft-store';
import { generateDraft } from './generate-draft';
import {
    FETCHES_PER_IP,
    fetchIpKey,
    GENERATION_GLOBAL_KEY,
    GENERATIONS_GLOBAL,
    generationIpKey,
    GENERATIONS_PER_IP,
} from './limits';

/**
 * Gałęzie degradacji orkiestratora (review B, P2 #8, #9): limity kończą się `limited` przed
 * kosztem, pudło geokodera nie blokuje szkicu.
 */

const mockRedis = createFakeRedis();

// Redis to zewnetrzny serwis. Getter, bo fabryka `jest.mock` jest hoistowana.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

const DESCRIPTION =
    'Gabinet stomatologiczny w centrum Warszawy, leczenie zachowawcze i protetyka dla dorosłych.';

async function generationCount(): Promise<string | null> {
    return mockRedis.get(generationIpKey(IP));
}

beforeEach(() => {
    mockRedis.reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('generateDraft — limity, link', () => {
    it('limit generowania wyczerpany w trakcie fetchu (wyscig) daje limited bez LLM', async () => {
        const h = harness();
        const fetchPage = h.fetchHtml.getMockImplementation();
        // Rownolegle zgloszenie z tego IP zuzywa ostatnie generowanie, gdy my pobieramy strone.
        h.fetchHtml.mockImplementation(async (url: string, options: { timeoutMs: number }) => {
            mockRedis.seed(generationIpKey(IP), String(GENERATIONS_PER_IP), 3600);
            if (fetchPage === undefined) throw new Error('brak implementacji fetchHtml');
            return fetchPage(url, options);
        });

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({ status: 'limited', retryAfter: 3600 });
        expect(h.fetchHtml).toHaveBeenCalled();
        expect(h.llmCreate).not.toHaveBeenCalled();
    });

    it('wyczerpany limit pobran daje limited bez fetchu i bez zapytania o duplikat', async () => {
        const h = harness();
        mockRedis.seed(fetchIpKey(IP), String(FETCHES_PER_IP), 1800);

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({ status: 'limited', retryAfter: 1800 });
        expect(h.fetchHtml).not.toHaveBeenCalled();
        expect(h.findDuplicate).not.toHaveBeenCalled();
    });

    it('wyczerpany limit globalny blokuje mimo wolnego limitu IP', async () => {
        const h = harness();
        mockRedis.seed(GENERATION_GLOBAL_KEY, String(GENERATIONS_GLOBAL), 900);

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({ status: 'limited', retryAfter: 900 });
        expect(await generationCount()).toBeNull();
        expect(h.fetchHtml).not.toHaveBeenCalled();
        expect(h.llmCreate).not.toHaveBeenCalled();
    });
});

describe('generateDraft — limity, tryb reczny', () => {
    it('wyczerpany limit generowania daje limited bez LLM', async () => {
        const h = harness();
        mockRedis.seed(generationIpKey(IP), String(GENERATIONS_PER_IP), 3600);

        const result = await generateDraft(
            {
                formData: manualForm({
                    name: 'Gabinet',
                    city: 'Warszawa',
                    description: DESCRIPTION,
                }),
                ip: IP,
                locale: 'pl',
            },
            h.deps,
        );

        expect(result).toEqual({ status: 'limited', retryAfter: 3600 });
        expect(h.llmCreate).not.toHaveBeenCalled();
    });
});

describe('generateDraft — porazka geokodera', () => {
    it('pudlo geokodera nie blokuje szkicu wpisu lokalnego — brak pinu', async () => {
        const h = harness();
        h.geocode.mockResolvedValue({ ok: false, code: 'NOT_FOUND' });

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        if (result.status !== 'ready') throw new Error(`oczekiwano ready, jest ${result.status}`);
        expect(result.pin).toBeNull();
        const stored = await getDraft(result.draftId);
        expect(stored.ok && stored.stored.geo).toBeNull();
    });
});
