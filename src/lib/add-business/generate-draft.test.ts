/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    completion,
    harness,
    IP,
    linkForm,
    manualForm,
    MODEL_DRAFT,
    SITE,
} from '../../../tests/fixtures/add-business/generate-draft-harness';
import { getDraft } from './draft-store';
import { generateDraft } from './generate-draft';
import { GENERATION_GLOBAL_KEY, generationIpKey, GENERATIONS_PER_IP } from './limits';
import { DraftGenerationError } from './llm-draft';

const mockRedis = createFakeRedis();

// Redis to zewnetrzny serwis. Getter, bo fabryka `jest.mock` jest hoistowana.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

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

describe('generateDraft — link', () => {
    it('link do Instagrama kieruje do trybu recznego bez fetchu, LLM i limitu generowania', async () => {
        const h = harness();
        const url = 'https://www.instagram.com/gabinetzdrowie';

        const result = await generateDraft(
            { formData: linkForm(url), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({
            status: 'needsManual',
            reason: 'SOCIAL_LINK',
            prefill: { link: url },
        });
        expect(h.fetchHtml).not.toHaveBeenCalled();
        expect(h.llmCreate).not.toHaveBeenCalled();
        expect(h.findDuplicate).not.toHaveBeenCalled();
        expect(await generationCount()).toBeNull();
    });

    it('domena istniejacego wpisu daje duplikat z nazwa i slugiem wpisu', async () => {
        const h = harness();
        h.findDuplicate.mockResolvedValue({ name: 'Gabinet Zdrowie', slug: 'gabinet-zdrowie' });

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'ru' },
            h.deps,
        );

        // Link do wpisu buduje UI z `slug` (`Link` z `@/i18n/navigation`, prefiks locale).
        expect(result).toEqual({
            status: 'duplicate',
            name: 'Gabinet Zdrowie',
            slug: 'gabinet-zdrowie',
        });
        expect(h.findDuplicate).toHaveBeenCalledWith('gabinet-zdrowie.pl', 'ru');
        expect(h.fetchHtml).not.toHaveBeenCalled();
        expect(await generationCount()).toBeNull();
    });

    it('timeout pobrania strony daje tryb reczny i nie zuzywa limitu generowania', async () => {
        const h = harness();
        h.fetchHtml.mockResolvedValue({ ok: false, code: 'TIMEOUT' });

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({
            status: 'needsManual',
            reason: 'UNREADABLE',
            prefill: { link: SITE },
        });
        expect(h.llmCreate).not.toHaveBeenCalled();
        expect(await generationCount()).toBeNull();
    });

    it('blad sieci przy pobraniu strony tez daje tryb reczny', async () => {
        const h = harness();
        h.fetchHtml.mockResolvedValue({ ok: false, code: 'NETWORK_ERROR' });

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result.status === 'needsManual' && result.reason).toBe('UNREADABLE');
    });

    it('wyczerpany limit generowania daje limited przed jakimkolwiek fetchem', async () => {
        const h = harness();
        mockRedis.seed(generationIpKey(IP), String(GENERATIONS_PER_IP), 3600);

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({ status: 'limited', retryAfter: 3600 });
        expect(h.fetchHtml).not.toHaveBeenCalled();
        expect(h.findDuplicate).not.toHaveBeenCalled();
    });

    it('happy path: szkic zapisany, LLM raz, limit generowania zuzyty raz', async () => {
        const h = harness();

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'uk' },
            h.deps,
        );

        if (result.status !== 'ready') throw new Error(`oczekiwano ready, jest ${result.status}`);
        expect(h.llmCreate).toHaveBeenCalledTimes(1);
        expect(await generationCount()).toBe('1');
        expect(await mockRedis.get(GENERATION_GLOBAL_KEY)).toBe('1');

        const stored = await getDraft(result.draftId);
        expect(stored.ok && stored.stored.locale).toBe('uk');
        expect(stored.ok && stored.stored.sourceUrl).toBe(SITE);
        // Fakty z JSON-LD, logo z og:image, pin z `geo` strony (knownGeo).
        expect(result.preview.name).toBe('Gabinet Zdrowie');
        expect(result.preview.phoneNumber).toBe('+48 22 123 45 67');
        expect(result.preview.webpage).toBe(SITE);
        expect(result.logoCandidate).toBe('https://cdn.gabinet-zdrowie.pl/og/logo.png');
        expect(result.pin).toEqual({ lat: 52.2297, lng: 21.0122, approximate: false });
        expect(h.geocode).toHaveBeenCalledWith(
            { street: 'ul. Marszałkowska 10', city: 'Warszawa' },
            { knownGeo: { lat: 52.2297, lng: 21.0122 } },
        );
    });

    it('wpis online nie jest geokodowany i nie ma pinu', async () => {
        const h = harness();
        h.llmCreate.mockResolvedValue(completion({ ...MODEL_DRAFT, coverage: 'online' }));

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result.status === 'ready' && result.pin).toBeNull();
        expect(h.geocode).not.toHaveBeenCalled();
    });

    it('awaria LLM daje kod GENERATION_FAILED bez surowego bledu', async () => {
        const h = harness();
        h.llmCreate.mockRejectedValue(
            new DraftGenerationError('UPSTREAM_FAILED', 'sk-proj-secret'),
        );

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({
            status: 'error',
            error: { code: 'GENERATION_FAILED', message: expect.any(String) },
        });
        expect(JSON.stringify(result)).not.toContain('sk-proj');
    });

    it('awaria Redisa przy zapisie szkicu daje INTERNAL', async () => {
        const h = harness();
        jest.spyOn(mockRedis, 'set').mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

        const result = await generateDraft(
            { formData: linkForm(SITE), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result.status === 'error' && result.error.code).toBe('INTERNAL');
        expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
    });

    it('niepoprawny link daje blad pola bez zuzycia limitow', async () => {
        const h = harness();

        const result = await generateDraft(
            { formData: linkForm('javascript:alert(1)'), ip: IP, locale: 'pl' },
            h.deps,
        );

        expect(result).toEqual({
            status: 'invalid',
            fieldErrors: { url: 'addBusiness.errors.invalidUrl' },
        });
        expect(h.fetchHtml).not.toHaveBeenCalled();
    });
});

describe('generateDraft — tryb reczny', () => {
    const DESCRIPTION =
        'Gabinet stomatologiczny w centrum Warszawy, leczenie zachowawcze i protetyka dla dorosłych.';

    it('tworzy szkic z danych wlasciciela; puste pola sa null i do uzupelnienia', async () => {
        const h = harness();

        const result = await generateDraft(
            {
                formData: manualForm({
                    name: 'Gabinet Zdrowie',
                    city: 'Warszawa',
                    street: 'ul. Prosta 5',
                    phoneNumber: '',
                    link: 'https://www.instagram.com/gabinetzdrowie',
                    description: DESCRIPTION,
                }),
                ip: IP,
                locale: 'pl',
            },
            h.deps,
        );

        if (result.status !== 'ready') throw new Error(`oczekiwano ready, jest ${result.status}`);
        expect(result.preview.phoneNumber).toBeNull();
        expect(result.unconfirmed).toEqual(
            expect.arrayContaining(['phoneNumber', 'postcode', 'email', 'openingHours']),
        );
        expect(result.preview.webpage).toBe('https://www.instagram.com/gabinetzdrowie');
        expect(result.logoCandidate).toBeNull();
        expect(h.fetchHtml).not.toHaveBeenCalled();
        expect(h.llmCreate).toHaveBeenCalledTimes(1);
        expect(await generationCount()).toBe('1');
        expect(h.geocode).toHaveBeenCalledWith(
            { street: 'ul. Prosta 5', city: 'Warszawa' },
            { knownGeo: null },
        );
    });

    it('brak opisu i za krotki opis to bledy pol, bez LLM i bez limitu', async () => {
        const h = harness();

        const missing = await generateDraft(
            { formData: manualForm({ name: 'X', city: 'Warszawa' }), ip: IP, locale: 'pl' },
            h.deps,
        );
        const tooShort = await generateDraft(
            {
                formData: manualForm({ name: 'X', city: 'Warszawa', description: 'krótko' }),
                ip: IP,
                locale: 'pl',
            },
            h.deps,
        );

        expect(missing).toEqual({
            status: 'invalid',
            fieldErrors: { description: 'addBusiness.errors.required' },
        });
        expect(tooShort).toEqual({
            status: 'invalid',
            fieldErrors: { description: 'addBusiness.errors.tooShort' },
        });
        expect(h.llmCreate).not.toHaveBeenCalled();
        expect(await generationCount()).toBeNull();
    });

    it('nieznany tryb to blad pola', async () => {
        const h = harness();
        const form = new FormData();

        const result = await generateDraft({ formData: form, ip: IP, locale: 'pl' }, h.deps);

        expect(result).toEqual({
            status: 'invalid',
            fieldErrors: { mode: 'addBusiness.errors.invalidValue' },
        });
    });
});
