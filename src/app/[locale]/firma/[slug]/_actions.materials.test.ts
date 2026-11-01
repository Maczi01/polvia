/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';
import type { PremiumCheckoutTarget } from '@/lib/premium-checkout-queries';
import { checkRateLimitWithTimeout } from '@/lib/rate-limit';

import { createFakeRedis } from '../../../../../tests/fixtures/add-business/fake-redis';
import { submitPremiumMaterials } from './_actions';

/**
 * `submitPremiumMaterials`. Zewnetrzne serwisy: Stripe, baza (za `premium-checkout-queries`),
 * Redis (limit i znacznik wysylki), SMTP i runtime Next. Logika akcji, weryfikacji sesji
 * (`@/lib/premium-checkout`) i znacznika (`@/lib/premium-materials-sent`) jest prawdziwa.
 */
const mockRetrieve = jest.fn();
const fakeRedis = createFakeRedis();
/** Atrapa nie ma `DEL` — ten sam efekt daje jej `GETDEL`. */
const mockRedis = {
    ...fakeRedis,
    del: async (key: string): Promise<number> => ((await fakeRedis.getdel(key)) === null ? 0 : 1),
};
const mockTargets = new Map<string, PremiumCheckoutTarget>();
/** Domyslnie klucz testowy (`sk_test_`), jak lokalnie i na Preview. */
const mockKeyMode = { isLive: false };

jest.mock('../../../../../env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://polvia.pl' } }));
jest.mock('@/db', () => ({ db: {} }));
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('next-intl/server', () => ({
    getLocale: async () => 'uk',
    getTranslations: async () => (key: string) => `t:${key}`,
}));
jest.mock('@/lib/rate-limit', () => ({
    checkRateLimitWithTimeout: jest.fn(),
    getClientIp: () => '203.0.113.7',
    rateLimitSubject: (ip: string) => ip,
}));
// Znacznik „materialy wyslane” (`premium-materials-sent`) jest prawdziwy, na atrapie Redisa.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));
// Klient leniwy i getter, bo fabryka `jest.mock` jest hoistowana nad inicjalizacje mockow.
jest.mock('@/lib/stripe', () => {
    const config = { priceMonthly: 'price_monthly_test', priceYearly: 'price_yearly_test' };
    return {
        getStripe: () => ({ checkout: { sessions: { retrieve: mockRetrieve } } }),
        stripeConfig: config,
        requireStripeConfig: () => config,
        isStripeConfigured: true,
        get STRIPE_LIVE_MODE() {
            return mockKeyMode.isLive;
        },
    };
});
jest.mock('@/lib/premium-checkout-queries', () => ({
    getPremiumCheckoutTarget: async (serviceId: string) => mockTargets.get(serviceId) ?? null,
}));

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';
const OTHER_SERVICE_ID = '0b9d3e47-8a26-4f1e-b5c3-7d2a6e9f4b02';
const TARGET: PremiumCheckoutTarget = {
    serviceId: SERVICE_ID,
    slug: 'mistrz-remontu',
    name: 'Mistrz Remontu',
    hasActivePremium: false,
};

function form(fields: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
}

function paidSession(clientReferenceId: string, paymentStatus = 'paid') {
    return {
        id: 'cs_test_paid',
        mode: 'subscription',
        status: 'complete',
        payment_status: paymentStatus,
        client_reference_id: clientReferenceId,
        line_items: { data: [{ price: { id: 'price_monthly_test' } }] },
        customer_details: { email: 'jan@firma.pl', name: 'Jan Kowalski', tax_ids: [] },
    };
}

beforeEach(() => {
    mockRetrieve.mockReset();
    fakeRedis.reset();
    mockTargets.clear();
    mockKeyMode.isLive = false;
    mockTargets.set(SERVICE_ID, TARGET);
    mockTargets.set(OTHER_SERVICE_ID, { ...TARGET, serviceId: OTHER_SERVICE_ID, slug: 'inna' });
    jest.mocked(checkRateLimitWithTimeout)
        .mockReset()
        .mockResolvedValue({ allowed: true, remaining: 1 });
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('submitPremiumMaterials', () => {
    const valid = {
        sessionId: 'cs_test_paid',
        slug: 'mistrz-remontu',
        template: 'professional',
        priceList: 'Wymiana zamka — od 150 zł',
    };

    it('oplacona sesja tego wpisu: mail do foundera z trescia i danymi platnika', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));

        const result = await submitPremiumMaterials(null, form(valid));

        expect(result).toEqual({ data: { sent: true } });
        expect(mockRetrieve).toHaveBeenCalledWith('cs_test_paid', { expand: ['line_items'] });
        const mail = jest.mocked(sendMail).mock.calls[0][0];
        expect(mail.to).toBe('founder@polvia.pl');
        expect(mail.replyTo).toBe('jan@firma.pl');
        expect(mail.subject).toContain('Mistrz Remontu');
        expect(mail.text).toContain('Szablon: professional');
        expect(mail.text).toContain('Wymiana zamka — od 150 zł');
        expect(mail.text).toContain('Jan Kowalski');
        expect(mail.text).toContain(`ID wpisu: ${SERVICE_ID}`);
        expect(mail.text).toContain('Profil: https://polvia.pl/firma/mistrz-remontu\n');
    });

    it('klucz testowy: temat maila z materialami oznaczony [TEST]', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));

        await submitPremiumMaterials(null, form(valid));

        const mail = jest.mocked(sendMail).mock.calls[0][0];
        expect(mail.subject).toBe('[TEST] Premium: materialy od Mistrz Remontu');
    });

    it('klucz produkcyjny: temat maila z materialami bez oznaczenia [TEST]', async () => {
        mockKeyMode.isLive = true;
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));

        await submitPremiumMaterials(null, form(valid));

        const mail = jest.mocked(sendMail).mock.calls[0][0];
        expect(mail.subject).toBe('Premium: materialy od Mistrz Remontu');
    });

    it('sesja nieoplacona: FORBIDDEN i brak maila', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID, 'unpaid'));

        const result = await submitPremiumMaterials(null, form(valid));

        expect(result).toEqual({ error: { code: 'FORBIDDEN', message: 't:FORBIDDEN' } });
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('oplacona sesja innego wpisu: FORBIDDEN i brak maila', async () => {
        mockRetrieve.mockResolvedValue(paidSession(OTHER_SERVICE_ID));

        const result = await submitPremiumMaterials(null, form(valid));

        expect(result).toEqual({ error: { code: 'FORBIDDEN', message: 't:FORBIDDEN' } });
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('blad sendMail: typowany SEND_FAILED bez surowego komunikatu', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));
        jest.mocked(sendMail).mockResolvedValue({ ok: false, code: 'SEND_FAILED' });

        const result = await submitPremiumMaterials(null, form(valid));

        expect(result).toEqual({ error: { code: 'SEND_FAILED', message: 't:SEND_FAILED' } });
    });

    it('awaria Stripe przy weryfikacji: VERIFY_FAILED i brak maila', async () => {
        mockRetrieve.mockRejectedValue(new Error('ETIMEDOUT'));

        const result = await submitPremiumMaterials(null, form(valid));

        expect(result).toEqual({ error: { code: 'VERIFY_FAILED', message: 't:VERIFY_FAILED' } });
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('bledne pola: BAD_INPUT z bledami pol, bez Stripe i bez limitu', async () => {
        const result = await submitPremiumMaterials(
            null,
            form({ ...valid, template: 'neon', notes: 'x'.repeat(2001) }),
        );

        expect(result).toEqual({
            error: {
                code: 'BAD_INPUT',
                message: 't:BAD_INPUT',
                fields: { template: 't:templateRequired', notes: 't:tooLong' },
            },
        });
        expect(mockRetrieve).not.toHaveBeenCalled();
        expect(checkRateLimitWithTimeout).not.toHaveBeenCalled();
    });

    it('po przekroczeniu limitu: RATE_LIMITED bez Stripe', async () => {
        jest.mocked(checkRateLimitWithTimeout).mockResolvedValue({ allowed: false, retryAfter: 60 });

        const result = await submitPremiumMaterials(null, form(valid));

        expect(result).toEqual({ error: { code: 'RATE_LIMITED', message: 't:RATE_LIMITED' } });
        expect(mockRetrieve).not.toHaveBeenCalled();
    });
});

describe('submitPremiumMaterials: jedna wysylka na sesje', () => {
    const valid = {
        sessionId: 'cs_test_paid',
        slug: 'mistrz-remontu',
        template: 'professional',
    };

    afterEach(() => {
        jest.useRealTimers();
    });

    it('druga proba tej samej sesji: ten sam sukces, bez drugiego maila', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));

        expect(await submitPremiumMaterials(null, form(valid))).toEqual({ data: { sent: true } });
        expect(await submitPremiumMaterials(null, form(valid))).toEqual({ data: { sent: true } });

        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('znacznik zajmuje dopiero zweryfikowana sesja', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID, 'unpaid'));

        await submitPremiumMaterials(null, form(valid));

        expect(await fakeRedis.get('premium:materials-sent:cs_test_paid')).toBeNull();
    });

    it('nieudana wysylka zwalnia znacznik: ponowna proba wysyla mail', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));
        jest.mocked(sendMail)
            .mockResolvedValueOnce({ ok: false, code: 'SEND_FAILED' })
            .mockResolvedValueOnce({ ok: true });

        expect(await submitPremiumMaterials(null, form(valid))).toMatchObject({
            error: { code: 'SEND_FAILED' },
        });
        expect(await submitPremiumMaterials(null, form(valid))).toEqual({ data: { sent: true } });
        expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('awaria Redisa przy znaczniku nie blokuje materialow: mail wychodzi z logiem', async () => {
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));
        jest.spyOn(mockRedis, 'set').mockRejectedValue(new Error('Connection is closed.'));

        expect(await submitPremiumMaterials(null, form(valid))).toEqual({ data: { sent: true } });
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('sent marker unavailable'),
            { error: 'Error' },
        );
    });

    it('zawieszony SMTP: SEND_FAILED po 20 s i znacznik zwolniony', async () => {
        jest.useFakeTimers();
        mockRetrieve.mockResolvedValue(paidSession(SERVICE_ID));
        jest.mocked(sendMail).mockReturnValueOnce(new Promise(() => {}));

        const result = submitPremiumMaterials(null, form(valid));
        await jest.advanceTimersByTimeAsync(20_000);

        expect(await result).toEqual({ error: { code: 'SEND_FAILED', message: 't:SEND_FAILED' } });
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('mail timed out'), {
            timeoutMs: 20_000,
        });
        expect(await fakeRedis.get('premium:materials-sent:cs_test_paid')).toBeNull();
    });
});
