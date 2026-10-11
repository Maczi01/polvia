/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import type { BusinessDraft } from './draft-schema';
import { getDraft, saveDraft, type StoredDraft } from './draft-store';
import type { GeocodeResult } from './geocode';
import { submitIpKey, SUBMISSIONS_PER_IP } from './limits';
import { submitDraft, type SubmitDraftDeps } from './submit-draft';

const mockRedis = createFakeRedis();

// Redis i SMTP (przez wstrzykniety `sendMail`) to zewnetrzne serwisy.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

// env.ts laduje @t3-oss/env-nextjs (wylacznie ESM) — podajemy zmienne jawnie.
jest.mock('../../../env', () => ({
    env: { MY_GMAIL: 'operator@example.com', MY_GMAIL_PASSWORD: 'app-password' },
}));

const IP = '198.51.100.20';
const OWNER_EMAIL = 'wlasciciel@example.com';
const OWNER_NOTES = 'Mamy tez punkt w Gdansku, prosze o kontakt pod 600 000 000.';

const TAG = { pl: 'Prawo pracy', uk: 'Трудове право', en: 'Labour law', ru: 'Трудовое право' };

const DRAFT: BusinessDraft = {
    category: 'law',
    coverage: 'hybrid',
    languages: ['pl', 'uk'],
    tags: [TAG, TAG, TAG],
    descriptions: { pl: 'Opis pl', uk: 'Опис uk', en: 'Description en', ru: 'Описание ru' },
    facts: {
        name: 'Kancelaria Nowak',
        street: 'ul. Prosta 1',
        postcode: '00-001',
        city: 'Warszawa',
        phoneNumber: null,
        email: 'biuro@nowak.example.pl',
        openingHours: null,
    },
    unconfirmed: ['phoneNumber', 'openingHours'],
};

const STORED: StoredDraft = {
    draft: DRAFT,
    locale: 'pl',
    source: 'page',
    sourceUrl: 'https://nowak.example.pl/',
    logoCandidate: null,
    geo: {
        lat: 52.23,
        lng: 21.01,
        approximate: false,
        voivodeship: 'mazowieckie',
        postcode: '00-001',
        address: { street: 'ul. Prosta 1', city: 'Warszawa' },
    },
};

const GEOCODED: GeocodeResult = {
    ok: true,
    lat: 50.06,
    lng: 19.94,
    postcode: '30-001',
    voivodeship: 'malopolskie',
    approximate: true,
};

const LOGO_PNG = Buffer.from('png-bytes');

interface Harness {
    deps: SubmitDraftDeps;
    sendMail: jest.Mock;
    geocode: jest.Mock;
    fetchLogoCandidate: jest.Mock;
}

function harness(): Harness {
    const sendMail = jest.fn().mockResolvedValue({ ok: true });
    const geocode = jest.fn().mockResolvedValue(GEOCODED);
    const fetchLogoCandidate = jest.fn().mockResolvedValue(LOGO_PNG);
    return {
        deps: { sendMail, geocode, fetchLogoCandidate },
        sendMail,
        geocode,
        fetchLogoCandidate,
    };
}

function submitForm(draftId: string, overrides: Record<string, string> = {}): FormData {
    const form = new FormData();
    const fields: Record<string, string> = {
        draftId,
        name: 'Kancelaria Nowak',
        street: 'ul. Prosta 1',
        postcode: '00-001',
        city: 'Warszawa',
        phoneNumber: '',
        email: 'biuro@nowak.example.pl',
        webpage: 'https://nowak.example.pl/',
        submitterEmail: OWNER_EMAIL,
        notes: OWNER_NOTES,
        ...overrides,
    };
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    form.append('languages', 'pl');
    form.append('languages', 'uk');
    return form;
}

function operatorEntry(sendMail: jest.Mock): Record<string, unknown> {
    const [message] = sendMail.mock.calls[0];
    return JSON.parse(message.attachments[0].content);
}

beforeEach(() => {
    mockRedis.reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('submitDraft', () => {
    it('wysyla oba maile, zuzywa szkic i zwraca karte do podziekowania', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        if (result.status !== 'sent') throw new Error(`oczekiwano sent, jest ${result.status}`);
        expect(result.card.name).toBe('Kancelaria Nowak');
        expect(result.card.category).toBe('law');
        expect(result.pin).toEqual({ lat: 52.23, lng: 21.01, approximate: false });
        expect(result.hasLogo).toBe(false);
        expect(h.sendMail).toHaveBeenCalledTimes(2);
        expect(h.sendMail.mock.calls[1][0].to).toBe(OWNER_EMAIL);
        // Adres bez zmian: wspolrzedne ze szkicu, bez drugiego geokodowania.
        expect(h.geocode).not.toHaveBeenCalled();
        expect(await getDraft(draftId)).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
    });

    it('wygasly szkic daje DRAFT_EXPIRED bez maila i bez zuzycia limitu wysylek', async () => {
        const h = harness();

        const result = await submitDraft(
            { formData: submitForm('5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e'), ip: IP },
            h.deps,
        );

        expect(result).toEqual({
            status: 'error',
            error: { code: 'DRAFT_EXPIRED', message: expect.any(String) },
        });
        expect(h.sendMail).not.toHaveBeenCalled();
        expect(await mockRedis.get(submitIpKey(IP))).toBeNull();
    });

    it('sfalszowana kategoria w FormData nie trafia do pliku wpisu (R9)', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);
        const form = submitForm(draftId, { category: 'food', coverage: 'online', tags: 'Spam' });

        const result = await submitDraft({ formData: form, ip: IP }, h.deps);

        expect(result.status).toBe('sent');
        const entry = operatorEntry(h.sendMail);
        expect(entry.category).toBe('law');
        expect(entry.coverage).toBe('hybrid');
        expect(entry.tags).toEqual([TAG, TAG, TAG]);
    });

    it('awaria maila operatora daje SEND_FAILED i log wpisu bez danych zglaszajacego', async () => {
        const h = harness();
        h.sendMail.mockResolvedValueOnce({ ok: false, code: 'SEND_FAILED' });
        const draftId = await saveDraft(STORED);

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(result.status === 'error' && result.error.code).toBe('SEND_FAILED');
        expect(h.sendMail).toHaveBeenCalledTimes(1);
        const logged = jest
            .mocked(console.error)
            .mock.calls.find(([message]) => String(message).includes('operator mail failed'));
        expect(logged?.[1]).toEqual(
            expect.objectContaining({
                slug: 'kancelaria-nowak',
                entry: expect.objectContaining({ name: 'Kancelaria Nowak', category: 'law' }),
            }),
        );
        expect(JSON.stringify(logged)).not.toContain(OWNER_EMAIL);
        expect(JSON.stringify(logged)).not.toContain('Gdansku');
    });

    it('awaria potwierdzenia nie zmienia wyniku — zgloszenie dotarlo', async () => {
        const h = harness();
        h.sendMail
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: false, code: 'SEND_FAILED' });
        const draftId = await saveDraft(STORED);

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(result.status).toBe('sent');
    });

    it('zmieniony adres jest geokodowany ponownie', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);
        const form = submitForm(draftId, { street: 'ul. Długa 2', city: 'Kraków', postcode: '' });

        const result = await submitDraft({ formData: form, ip: IP }, h.deps);

        expect(h.geocode).toHaveBeenCalledWith(
            { street: 'ul. Długa 2', city: 'Kraków' },
            { knownGeo: null },
        );
        expect(result.status === 'sent' && result.pin).toEqual({
            lat: 50.06,
            lng: 19.94,
            approximate: true,
        });
        expect(result.status === 'sent' && result.card.postcode).toBe('30-001');
    });

    it('zly plik logo to blad pola; szkic i limit wysylek zostaja nietkniete', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);
        const form = submitForm(draftId);
        form.set(
            'logo',
            new File([Buffer.from('to nie jest obrazek')], 'logo.png', { type: 'image/png' }),
        );

        const result = await submitDraft({ formData: form, ip: IP }, h.deps);

        expect(result).toEqual({
            status: 'invalid',
            fieldErrors: { logo: 'addBusiness.errors.invalidLogo' },
        });
        expect((await getDraft(draftId)).ok).toBe(true);
        expect(await mockRedis.get(submitIpKey(IP))).toBeNull();
    });

    it('bez uploadu bierze logo kandydata ze strony i dolacza je do maila', async () => {
        const h = harness();
        const draftId = await saveDraft({
            ...STORED,
            logoCandidate: 'https://nowak.example.pl/logo.png',
        });

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(h.fetchLogoCandidate).toHaveBeenCalledWith('https://nowak.example.pl/logo.png');
        expect(result.status === 'sent' && result.hasLogo).toBe(true);
        const [operatorMessage] = h.sendMail.mock.calls[0];
        expect(operatorMessage.attachments[1]).toEqual(
            expect.objectContaining({ filename: 'kancelaria-nowak.png', content: LOGO_PNG }),
        );
    });

    it('wyczerpany limit wysylek daje limited i nie zuzywa szkicu', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);
        mockRedis.seed(submitIpKey(IP), String(SUBMISSIONS_PER_IP), 600);

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(result).toEqual({ status: 'limited', retryAfter: 600 });
        expect((await getDraft(draftId)).ok).toBe(true);
    });

    it('brak e-maila zglaszajacego to blad pola', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);

        const result = await submitDraft(
            { formData: submitForm(draftId, { submitterEmail: '' }), ip: IP },
            h.deps,
        );

        expect(result).toEqual({
            status: 'invalid',
            fieldErrors: { submitterEmail: 'addBusiness.errors.required' },
        });
    });

    it('awaria Redisa przy geokodowaniu daje INTERNAL i nie pali szkicu', async () => {
        const h = harness();
        h.geocode.mockRejectedValue(new Error('connect ECONNREFUSED'));
        const draftId = await saveDraft(STORED);
        const form = submitForm(draftId, { city: 'Kraków' });

        const result = await submitDraft({ formData: form, ip: IP }, h.deps);

        expect(result.status === 'error' && result.error.code).toBe('INTERNAL');
        expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
        expect((await getDraft(draftId)).ok).toBe(true);
    });
});
