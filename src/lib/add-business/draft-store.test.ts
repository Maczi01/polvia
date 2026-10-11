import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import type { BusinessDraft } from './draft-schema';
import {
    consumeDraft,
    DRAFT_TTL_SECONDS,
    type DraftGeo,
    getDraft,
    MAX_RELOCATIONS,
    reserveRelocation,
    saveDraft,
    type StoredDraft,
    updateDraftGeo,
} from './draft-store';

const mockRedis = createFakeRedis();

// Redis to zewnetrzny serwis. Getter, bo fabryka `jest.mock` jest hoistowana nad
// inicjalizacje `mockRedis` — odczyt nastepuje dopiero przy pierwszym wywolaniu.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

const DRAFT: BusinessDraft = {
    category: 'law',
    coverage: 'hybrid',
    languages: ['pl', 'uk'],
    tags: [{ pl: 'Prawo pracy', uk: 'Трудове право', en: 'Labour law', ru: 'Трудовое право' }],
    descriptions: {
        pl: 'Kancelaria prawna.',
        uk: 'Юридична фірма.',
        en: 'Law firm.',
        ru: 'Юридическая фирма.',
    },
    facts: {
        name: 'Kancelaria Test',
        street: 'Marszałkowska 1',
        postcode: '00-001',
        city: 'Warszawa',
        phoneNumber: null,
        email: 'biuro@example.pl',
        openingHours: { monday: { open: '09:00', close: '17:00' } },
    },
    unconfirmed: ['phoneNumber'],
};

const GEO: DraftGeo = {
    lat: 52.23,
    lng: 21.01,
    approximate: false,
    voivodeship: 'mazowieckie',
    postcode: '00-001',
    address: { street: 'Marszałkowska 1', city: 'Warszawa' },
};

const STORED: StoredDraft = {
    draft: DRAFT,
    locale: 'uk',
    source: 'page',
    sourceUrl: 'https://kancelaria-test.pl/',
    logoCandidate: 'https://kancelaria-test.pl/logo.png',
    geo: GEO,
};

let warn: jest.SpyInstance;

beforeEach(() => {
    mockRedis.reset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    warn.mockRestore();
});

describe('saveDraft / consumeDraft', () => {
    it('zapisany szkic wraca przy consume w niezmienionej postaci', async () => {
        const draftId = await saveDraft(STORED);

        const result = await consumeDraft(draftId);

        expect(result).toEqual({ ok: true, stored: STORED });
    });

    it('drugie consume tego samego szkicu zwraca DRAFT_EXPIRED', async () => {
        const draftId = await saveDraft(STORED);
        await consumeDraft(draftId);

        expect(await consumeDraft(draftId)).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
    });

    it('szkic wygasa po 2 h', async () => {
        const draftId = await saveDraft(STORED);
        mockRedis.advance(DRAFT_TTL_SECONDS);

        expect(await consumeDraft(draftId)).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
    });

    it('identyfikator spoza formatu UUID odrzuca bez zapytania do Redisa', async () => {
        const getdel = jest.spyOn(mockRedis, 'getdel');

        const result = await consumeDraft('add-business:gen:global');

        expect(result).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
        expect(getdel).not.toHaveBeenCalled();
        getdel.mockRestore();
    });
});

describe('odczyt uszkodzonych danych', () => {
    const DRAFT_ID = '3f2b8c1e-6a4d-4e2f-9b7a-1c2d3e4f5a6b';

    it('uszkodzony JSON daje DRAFT_EXPIRED i log zamiast wyjatku', async () => {
        mockRedis.seed(`add-business:draft:${DRAFT_ID}`, '{"draft":', DRAFT_TTL_SECONDS);

        const result = await consumeDraft(DRAFT_ID);

        expect(result).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
        expect(warn).toHaveBeenCalledWith(
            'add-business draft unreadable',
            expect.objectContaining({ draftId: DRAFT_ID, reason: 'invalid-json' }),
        );
    });

    it('JSON o zlym ksztalcie daje DRAFT_EXPIRED bez logowania tresci', async () => {
        const tampered = { ...STORED, draft: { ...DRAFT, category: 'not-a-category' } };
        mockRedis.seed(`add-business:draft:${DRAFT_ID}`, JSON.stringify(tampered));

        const result = await getDraft(DRAFT_ID);

        expect(result).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
        expect(warn).toHaveBeenCalledWith('add-business draft unreadable', {
            draftId: DRAFT_ID,
            reason: 'schema',
            paths: ['draft.category'],
        });
    });
});

describe('getDraft', () => {
    it('odczyt nie usuwa szkicu', async () => {
        const draftId = await saveDraft(STORED);

        await getDraft(draftId);

        expect(await consumeDraft(draftId)).toMatchObject({ ok: true });
    });
});

describe('updateDraftGeo', () => {
    it('podmienia geo i zachowuje pozostaly TTL', async () => {
        const draftId = await saveDraft({ ...STORED, geo: null });
        mockRedis.advance(3600);

        const written = await updateDraftGeo(draftId, GEO);

        expect(written).toEqual({ ok: true });
        expect(await mockRedis.ttl(`add-business:draft:${draftId}`)).toBe(DRAFT_TTL_SECONDS - 3600);
        expect(await getDraft(draftId)).toEqual({ ok: true, stored: { ...STORED, geo: GEO } });
    });

    it('nie wskrzesza szkicu, ktory juz wyslano', async () => {
        const draftId = await saveDraft(STORED);
        await consumeDraft(draftId);

        expect(await updateDraftGeo(draftId, GEO)).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
        expect(await mockRedis.get(`add-business:draft:${draftId}`)).toBeNull();
    });
});

describe('reserveRelocation', () => {
    it(`przepuszcza ${MAX_RELOCATIONS} relokacji, kolejna odmawia`, async () => {
        const draftId = await saveDraft(STORED);

        for (let attempt = 1; attempt <= MAX_RELOCATIONS; attempt += 1) {
            expect(await reserveRelocation(draftId)).toEqual({
                ok: true,
                remaining: MAX_RELOCATIONS - attempt,
            });
        }

        expect(await reserveRelocation(draftId)).toEqual({ ok: false, code: 'RELOCATION_LIMIT' });
    });

    it('limit liczy sie osobno dla kazdego szkicu', async () => {
        const first = await saveDraft(STORED);
        const second = await saveDraft(STORED);
        for (let attempt = 0; attempt < MAX_RELOCATIONS; attempt += 1) {
            await reserveRelocation(first);
        }

        expect(await reserveRelocation(second)).toMatchObject({ ok: true });
    });

    it('identyfikator spoza formatu UUID daje DRAFT_EXPIRED', async () => {
        expect(await reserveRelocation('../../etc')).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
    });
});
