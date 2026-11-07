/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    harness,
    IP,
    LOGO_PNG,
    OWNER_EMAIL,
    OWNER_NOTES,
    STORED,
    submitForm,
} from '../../../tests/fixtures/add-business/submit-draft-harness';
import { getDraft, saveDraft } from './draft-store';
import { submitDraft } from './submit-draft';

/**
 * Zgloszenie trafia do panelu (tabela `service_submissions`), a operator dostaje krotkie
 * powiadomienie. Gdy zapis zawiedzie, dane ida pelnym mailem — nie moga przepasc.
 */

const SUBMISSION_ID = '11111111-2222-4333-8444-555555555555';

const mockRedis = createFakeRedis();

jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

jest.mock('../../../env', () => ({
    env: {
        MY_GMAIL: 'operator@example.com',
        MY_GMAIL_PASSWORD: 'app-password',
        NEXT_PUBLIC_SITE_URL: 'https://polvia.test',
    },
}));

function savedHarness(): ReturnType<typeof harness> {
    const h = harness();
    h.saveSubmission.mockResolvedValue({ ok: true, id: SUBMISSION_ID });
    return h;
}

beforeEach(() => {
    mockRedis.reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('submitDraft — zapis zgloszenia', () => {
    it('zapisuje zgloszenie z danymi zglaszajacego i logo', async () => {
        const h = savedHarness();
        const draftId = await saveDraft({ ...STORED, logoCandidate: 'https://nowak.pl/logo.png' });

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(result.status).toBe('sent');
        expect(h.saveSubmission).toHaveBeenCalledTimes(1);
        expect(h.saveSubmission).toHaveBeenCalledWith(
            expect.objectContaining({
                submitterEmail: OWNER_EMAIL,
                notes: OWNER_NOTES,
                logo: LOGO_PNG,
                manualPin: false,
                entry: expect.objectContaining({ slug: 'kancelaria-nowak' }),
            }),
        );
    });

    it.each([
        ['zaznaczona', { premiumInfoConsent: 'on' }, true],
        ['niezaznaczona', {}, false],
    ])('zgoda na premium %s trafia do zapisu, a nie do wpisu', async (_name, fields, expected) => {
        const h = savedHarness();
        const draftId = await saveDraft(STORED);

        await submitDraft({ formData: submitForm(draftId, fields), ip: IP }, h.deps);

        const [saved] = h.saveSubmission.mock.calls[0];
        expect(saved.premiumInfoConsent).toBe(expected);
        expect(JSON.stringify(saved.entry.json)).not.toContain('premiumInfoConsent');
    });

    it('po zapisie operator dostaje powiadomienie z linkiem, bez zalacznikow', async () => {
        const h = savedHarness();
        const draftId = await saveDraft(STORED);

        await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(h.sendMail).toHaveBeenCalledTimes(2);
        const [notification] = h.sendMail.mock.calls[0];
        expect(notification.to).toBe('operator@example.com');
        expect(notification.replyTo).toBe(OWNER_EMAIL);
        expect(notification.attachments).toBeUndefined();
        expect(notification.text).toContain('Kancelaria Nowak');
        expect(notification.text).toContain(
            `http://localhost:3000/dashboard/submissions/${SUBMISSION_ID}`,
        );
        expect(h.sendMail.mock.calls[1][0].to).toBe(OWNER_EMAIL);
    });

    it('awaria powiadomienia nie psuje zgloszenia, bo dane sa juz w panelu', async () => {
        const h = savedHarness();
        h.sendMail.mockResolvedValueOnce({ ok: false, code: 'SEND_FAILED' });
        const draftId = await saveDraft(STORED);

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(result.status).toBe('sent');
        expect(h.sendMail.mock.calls[1][0].to).toBe(OWNER_EMAIL);
        expect(await getDraft(draftId)).toEqual({ ok: false, code: 'DRAFT_EXPIRED' });
    });

    it('nieudany zapis wysyla pelny mail z JSON-em i logo', async () => {
        const h = harness();
        h.saveSubmission.mockResolvedValue({ ok: false });
        const draftId = await saveDraft({ ...STORED, logoCandidate: 'https://nowak.pl/logo.png' });

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(result.status).toBe('sent');
        const names = h.sendMail.mock.calls[0][0].attachments.map(
            (attachment: { filename: string }) => attachment.filename,
        );
        expect(names).toEqual(['kancelaria-nowak.json', 'kancelaria-nowak.png']);
    });

    it('nieudany zapis i nieudany mail daja SEND_FAILED oraz log wpisu', async () => {
        const h = harness();
        h.saveSubmission.mockResolvedValue({ ok: false });
        h.sendMail.mockResolvedValueOnce({ ok: false, code: 'SEND_FAILED' });
        const draftId = await saveDraft(STORED);

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(result.status === 'error' && result.error.code).toBe('SEND_FAILED');
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).toContain('Kancelaria Nowak');
    });
});
