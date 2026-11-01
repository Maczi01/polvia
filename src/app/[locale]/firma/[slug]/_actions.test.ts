/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';
import type { PremiumCheckoutTarget } from '@/lib/premium-checkout-queries';
import { checkRateLimitWithTimeout } from '@/lib/rate-limit';

import { createFakeRedis } from '../../../../../tests/fixtures/add-business/fake-redis';
import { startPremiumCheckout } from './_actions';

/**
 * Zewnetrzne serwisy: Stripe, baza (za `premium-checkout-queries`), Redis (limit), SMTP
 * i runtime Next (naglowki, przekierowanie, tlumaczenia). Logika akcji i weryfikacji sesji
 * (`@/lib/premium-checkout`) jest prawdziwa. Akcja materialow: `_actions.materials.test.ts`
 * (te same atrapy — `jest.mock` musi stac w pliku testu).
 */
const mockCreate = jest.fn();
const mockRetrieve = jest.fn();
const mockSearch = jest.fn();
const fakeRedis = createFakeRedis();
/** Atrapa nie ma `DEL` — ten sam efekt daje jej `GETDEL`. */
const mockRedis = {
    ...fakeRedis,
    del: async (key: string): Promise<number> => ((await fakeRedis.getdel(key)) === null ? 0 : 1),
};
const mockTargets = new Map<string, PremiumCheckoutTarget>();
/** Domyslnie klucz testowy (`sk_test_`), jak lokalnie i na Preview. */
const mockKeyMode = { isLive: false };

class MockRedirectSignal extends Error {
    constructor(readonly url: string) {
        super('NEXT_REDIRECT');
    }
}

jest.mock('../../../../../env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://polvia.pl' } }));
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
        getStripe: () => ({
            checkout: { sessions: { create: mockCreate, retrieve: mockRetrieve } },
            subscriptions: { search: mockSearch },
        }),
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

beforeEach(() => {
    mockCreate.mockReset();
    mockRetrieve.mockReset();
    mockSearch.mockReset().mockResolvedValue({ data: [] });
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

describe('startPremiumCheckout', () => {
    it('niepoprawny interwal: BAD_INPUT bez limitu i bez Stripe', async () => {
        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'lifetime' }),
        );

        expect(result).toEqual({ error: { code: 'BAD_INPUT', message: 't:BAD_INPUT' } });
        expect(mockCreate).not.toHaveBeenCalled();
        expect(checkRateLimitWithTimeout).not.toHaveBeenCalled();
    });

    it('po przekroczeniu limitu: RATE_LIMITED, Stripe niewolany', async () => {
        jest.mocked(checkRateLimitWithTimeout).mockResolvedValue({ allowed: false, retryAfter: 60 });

        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'monthly' }),
        );

        expect(result?.error.code).toBe('RATE_LIMITED');
        expect(jest.mocked(checkRateLimitWithTimeout).mock.calls[0][0].key).toBe(
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

    it('oplacona subskrypcja w Stripe przed webhookiem: ALREADY_PREMIUM bez sesji', async () => {
        mockSearch.mockResolvedValue({ data: [{ status: 'active' }] });

        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'monthly' }),
        );

        expect(result?.error.code).toBe('ALREADY_PREMIUM');
        expect(mockSearch).toHaveBeenCalledWith({
            query: `metadata['serviceId']:'${SERVICE_ID}'`,
            limit: 10,
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('awaria wyszukiwania subskrypcji nie blokuje sprzedazy', async () => {
        mockSearch.mockRejectedValue(new Error('ETIMEDOUT'));
        mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_3' });

        await expect(
            startPremiumCheckout(null, form({ serviceId: SERVICE_ID, interval: 'monthly' })),
        ).rejects.toEqual(new MockRedirectSignal('https://checkout.stripe.com/c/pay/cs_test_3'));
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('subscription search failed'),
            { name: 'Error' },
        );
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
