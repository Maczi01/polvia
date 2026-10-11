/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    harness,
    IP,
    LOGO_PNG,
    operatorEntry,
    OWNER_EMAIL,
    STORED,
    submitForm,
    TAG,
} from '../../../tests/fixtures/add-business/submit-draft-harness';
import { getDraft, saveDraft } from './draft-store';
import { submitIpKey, SUBMISSIONS_PER_IP } from './limits';
import { submitDraft } from './submit-draft';

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
