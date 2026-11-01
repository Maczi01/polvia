/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';
import type { PremiumCheckoutTarget } from '@/lib/premium-checkout-queries';
import { checkRateLimit } from '@/lib/rate-limit';

import { startPremiumCheckout, submitPremiumMaterials } from './_actions';

/**
 * Zewnetrzne serwisy: Stripe, baza (za `premium-checkout-queries`), Redis (limit), SMTP
 * i runtime Next (naglowki, przekierowanie, tlumaczenia). Logika akcji i weryfikacji sesji
 * (`@/lib/premium-checkout`) jest prawdziwa.
 */
const mockCreate = jest.fn();
const mockRetrieve = jest.fn();
const mockTargets = new Map<string, PremiumCheckoutTarget>();

class MockRedirectSignal extends Error {
    constructor(readonly url: string) {
        super('NEXT_REDIRECT');
    }
}

jest.mock('../../../../../env', () => ({
    env: {
        NEXT_PUBLIC_SITE_URL: 'https://polvia.pl',
        STRIPE_PRICE_MONTHLY: 'price_monthly_test',
        STRIPE_PRICE_YEARLY: 'price_yearly_test',
    },
}));
jest.mock('@/db', () => ({ db: {} }));
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
jest.mock('next/navigation', () => ({
    redirect: (url: string) => {
        throw new MockRedirectSignal(url);
    },
}));
jest.mock('next-intl/server', () => ({
    getLocale: async () => 'uk',
    getTranslations: async () => (key: string) => `t:${key}`,
}));
jest.mock('@/lib/rate-limit', () => ({
    checkRateLimit: jest.fn(),
    getClientIp: () => '203.0.113.7',
    rateLimitSubject: (ip: string) => ip,
}));
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));
// Gettery, bo fabryka `jest.mock` jest hoistowana nad inicjalizacje mockow.
jest.mock('@/lib/stripe', () => ({
    stripe: {
        checkout: {
            sessions: {
                get create() {
                    return mockCreate;
                },
                get retrieve() {
                    return mockRetrieve;
                },
            },
        },
    },
}));
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
    mockCreate.mockReset();
    mockRetrieve.mockReset();
    mockTargets.clear();
    mockTargets.set(SERVICE_ID, TARGET);
    mockTargets.set(OTHER_SERVICE_ID, { ...TARGET, serviceId: OTHER_SERVICE_ID, slug: 'inna' });
    jest.mocked(checkRateLimit).mockReset().mockResolvedValue({ allowed: true, remaining: 1 });
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('startPremiumCheckout', () => {
    it('niepoprawny interwal: BAD_INPUT bez limitu i bez Stripe', async () => {
        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'lifetime' }),
        );

        expect(result).toEqual({ error: { code: 'BAD_INPUT', message: 't:BAD_INPUT' } });
        expect(mockCreate).not.toHaveBeenCalled();
        expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('po przekroczeniu limitu: RATE_LIMITED, Stripe niewolany', async () => {
        jest.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 60 });

        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'monthly' }),
        );

        expect(result?.error.code).toBe('RATE_LIMITED');
        expect(jest.mocked(checkRateLimit).mock.calls[0][0].key).toBe(
            'premium:checkout:203.0.113.7',
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('wpis z aktywnym premium: ALREADY_PREMIUM', async () => {
        mockTargets.set(SERVICE_ID, { ...TARGET, hasActivePremium: true });

        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'monthly' }),
        );

        expect(result?.error.code).toBe('ALREADY_PREMIUM');
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('nieaktywny albo nieistniejacy wpis: NOT_FOUND', async () => {
        mockTargets.clear();

        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'monthly' }),
        );

        expect(result?.error.code).toBe('NOT_FOUND');
    });

    it('poprawne dane: sesja z cena z env, wpisem i slugiem w metadanych, potem redirect', async () => {
        mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

        await expect(
            startPremiumCheckout(null, form({ serviceId: SERVICE_ID, interval: 'yearly' })),
        ).rejects.toEqual(new MockRedirectSignal('https://checkout.stripe.com/c/pay/cs_test_1'));

        const params = mockCreate.mock.calls[0][0];
        expect(params.mode).toBe('subscription');
        expect(params.line_items).toEqual([{ price: 'price_yearly_test', quantity: 1 }]);
        expect(params.client_reference_id).toBe(SERVICE_ID);
        expect(params.subscription_data.metadata).toEqual({
            serviceId: SERVICE_ID,
            serviceSlug: 'mistrz-remontu',
        });
        expect(params.success_url).toBe(
            'https://polvia.pl/uk/firma/mistrz-remontu/premium/dziekujemy?session_id={CHECKOUT_SESSION_ID}',
        );
    });

    it('blad Stripe: CHECKOUT_FAILED bez surowego komunikatu', async () => {
        mockCreate.mockRejectedValue(new Error('Your card was declined: raw stripe text'));

        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'monthly' }),
        );

        expect(result).toEqual({
            error: { code: 'CHECKOUT_FAILED', message: 't:CHECKOUT_FAILED' },
        });
    });
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
        expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it('po przekroczeniu limitu: RATE_LIMITED bez Stripe', async () => {
        jest.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 60 });

        const result = await submitPremiumMaterials(null, form(valid));

        expect(result).toEqual({ error: { code: 'RATE_LIMITED', message: 't:RATE_LIMITED' } });
        expect(mockRetrieve).not.toHaveBeenCalled();
    });
});
