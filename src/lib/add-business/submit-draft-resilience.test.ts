/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';

import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import {
    GEOCODED,
    harness,
    IP,
    LOGO_PNG,
    operatorEntry,
    STORED,
    submitForm,
} from '../../../tests/fixtures/add-business/submit-draft-harness';
import { saveDraft } from './draft-store';
import { submitIpKey, SUBMISSIONS_PER_IP } from './limits';
import { submitDraft } from './submit-draft';

/**
 * Odpornosc submitu na limity i awarie uslug zewnetrznych (review B: P2 #1, #2, #9):
 * kolejnosc limitu wzgledem sharpa, rownoleglosc geo/logo, zawieszony SMTP, pudla geokodera.
 */

const mockRedis = createFakeRedis();

// Redis i SMTP (przez wstrzykniety `sendMail`) to zewnetrzne serwisy.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

// Transport SMTP — zewnetrzny serwis. Uzywany tylko przez test z prawdziwym `sendMail`.
const mockSmtpSend = jest.fn();
jest.mock('nodemailer', () => ({
    __esModule: true,
    default: { createTransport: () => ({ sendMail: mockSmtpSend }) },
}));

// env.ts laduje @t3-oss/env-nextjs (wylacznie ESM) — podajemy zmienne jawnie.
jest.mock('../../../env', () => ({
    env: { MY_GMAIL: 'operator@example.com', MY_GMAIL_PASSWORD: 'app-password' },
}));

beforeEach(() => {
    mockRedis.reset();
    mockSmtpSend.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('submitDraft — odpornosc', () => {
    it('wyczerpany limit wysylek odrzuca przed dekodowaniem logo', async () => {
        const h = harness();
        const draftId = await saveDraft(STORED);
        mockRedis.seed(submitIpKey(IP), String(SUBMISSIONS_PER_IP), 600);
        const form = submitForm(draftId);
        // Plik, ktory sharp odrzuca: gdyby logo dekodowano przed limitem, wynikiem bylby
        // blad pola `logo`, a nie `limited`.
        form.set('logo', new File([Buffer.from('nie obrazek')], 'logo.png', { type: 'image/png' }));

        const result = await submitDraft({ formData: form, ip: IP }, h.deps);

        expect(result).toEqual({ status: 'limited', retryAfter: 600 });
        expect(jest.mocked(console.warn)).not.toHaveBeenCalledWith(
            'logo rejected by sharp',
            expect.anything(),
        );
    });

    it('geokodowanie i pobranie logo kandydata ida rownolegle', async () => {
        const h = harness();
        let releaseGeocode: () => void = () => {};
        // Geokoder odpowiada dopiero, gdy wystartuje pobieranie logo — sekwencyjny kod by utknal.
        h.geocode.mockImplementation(
            () =>
                new Promise(resolve => {
                    releaseGeocode = () => resolve(GEOCODED);
                }),
        );
        h.fetchLogoCandidate.mockImplementation(async () => {
            releaseGeocode();
            return LOGO_PNG;
        });
        const draftId = await saveDraft({
            ...STORED,
            logoCandidate: 'https://nowak.example.pl/logo.png',
        });
        const form = submitForm(draftId, { city: 'Kraków' });

        const result = await submitDraft({ formData: form, ip: IP }, h.deps);

        expect(result.status === 'sent' && result.hasLogo).toBe(true);
        expect(h.geocode).toHaveBeenCalledTimes(1);
    });

    it('zawieszony SMTP (timeout transportu) daje SEND_FAILED i log zgloszenia', async () => {
        const h = harness();
        mockSmtpSend.mockRejectedValue(
            Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }),
        );
        const draftId = await saveDraft(STORED);

        const result = await submitDraft(
            { formData: submitForm(draftId), ip: IP },
            { ...h.deps, sendMail },
        );

        expect(result.status === 'error' && result.error.code).toBe('SEND_FAILED');
        expect(mockSmtpSend).toHaveBeenCalledTimes(1);
        expect(jest.mocked(console.error)).toHaveBeenCalledWith(
            expect.stringContaining('operator mail failed'),
            expect.objectContaining({ slug: 'kancelaria-nowak' }),
        );
    });

    it('szkic bez geo i z niezmienionym adresem jest geokodowany ponownie', async () => {
        const h = harness();
        const draftId = await saveDraft({ ...STORED, geo: null });

        const result = await submitDraft({ formData: submitForm(draftId), ip: IP }, h.deps);

        expect(h.geocode).toHaveBeenCalledWith(
            { street: 'ul. Prosta 1', city: 'Warszawa' },
            { knownGeo: null },
        );
        expect(result.status === 'sent' && result.pin).toEqual({
            lat: 50.06,
            lng: 19.94,
            approximate: true,
        });
    });

    it('geokoder RATE_LIMITED nie blokuje wysylki — operator dostaje flage braku wspolrzednych', async () => {
        const h = harness();
        h.geocode.mockResolvedValue({ ok: false, code: 'RATE_LIMITED' });
        const draftId = await saveDraft(STORED);
        const form = submitForm(draftId, { street: 'ul. Długa 2', city: 'Kraków' });

        const result = await submitDraft({ formData: form, ip: IP }, h.deps);

        expect(result.status === 'sent' && result.pin).toBeNull();
        expect(JSON.stringify(operatorEntry(h.sendMail))).not.toContain('latitude');
        const [operatorMessage] = h.sendMail.mock.calls[0];
        expect(operatorMessage.text).toContain('uzupełnij latitude/longitude');
    });
});
