/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';
import { checkRateLimitWithTimeout } from '@/lib/rate-limit';

import { startPremiumCheckout, submitPremiumMaterials } from './_actions';

/**
 * Platnosci online wylaczone (brak zmiennych `STRIPE_*`): obie akcje premium to nadal
 * publiczne endpointy POST, wiec musza odmowic same — zanim dotkna limitu, bazy, Stripe i SMTP.
 * Zewnetrzne serwisy jak w `_actions.test.ts`; `@/lib/stripe` w stanie bez konfiguracji.
 */
const mockGetStripe = jest.fn();
const mockGetTarget = jest.fn();

jest.mock('../../../../../env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://polvia.pl' } }));
jest.mock('@/db', () => ({ db: {} }));
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
jest.mock('next/navigation', () => ({
    redirect: () => {
        throw new Error('NEXT_REDIRECT');
    },
}));
jest.mock('next-intl/server', () => ({
    getLocale: async () => 'pl',
    getTranslations: async () => (key: string) => `t:${key}`,
}));
jest.mock('@/lib/rate-limit', () => ({
    checkRateLimitWithTimeout: jest.fn(),
    getClientIp: () => '203.0.113.7',
    rateLimitSubject: (ip: string) => ip,
}));
jest.mock('@/lib/redis', () => ({ redis: {} }));
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));
jest.mock('@/lib/stripe', () => ({
    // Leniwie: fabryka `jest.mock` jest hoistowana nad inicjalizacje mockow.
    getStripe: () => mockGetStripe(),
    stripeConfig: null,
    requireStripeConfig: () => mockGetStripe(),
    isStripeConfigured: false,
    STRIPE_LIVE_MODE: false,
}));
jest.mock('@/lib/premium-checkout-queries', () => ({
    getPremiumCheckoutTarget: (serviceId: string) => mockGetTarget(serviceId),
}));

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';

function form(fields: Record<string, string>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
}

beforeEach(() => {
    mockGetStripe.mockReset();
    mockGetTarget.mockReset();
    jest.mocked(checkRateLimitWithTimeout).mockReset();
    jest.mocked(sendMail).mockReset();
});

describe('akcje premium bez konfiguracji Stripe', () => {
    it('startPremiumCheckout: CHECKOUT_DISABLED bez limitu, bazy i Stripe', async () => {
        const result = await startPremiumCheckout(
            null,
            form({ serviceId: SERVICE_ID, interval: 'monthly' }),
        );

        expect(result).toEqual({
            error: { code: 'CHECKOUT_DISABLED', message: 't:CHECKOUT_DISABLED' },
        });
        expect(checkRateLimitWithTimeout).not.toHaveBeenCalled();
        expect(mockGetTarget).not.toHaveBeenCalled();
        expect(mockGetStripe).not.toHaveBeenCalled();
    });

    it('submitPremiumMaterials: CHECKOUT_DISABLED bez Stripe i bez maila', async () => {
        const result = await submitPremiumMaterials(
            null,
            form({ sessionId: 'cs_test_a1B2c3D4e5F6g7H8', slug: 'roza', template: 'classic' }),
        );

        expect(result).toEqual({
            error: { code: 'CHECKOUT_DISABLED', message: 't:CHECKOUT_DISABLED' },
        });
        expect(checkRateLimitWithTimeout).not.toHaveBeenCalled();
        expect(mockGetStripe).not.toHaveBeenCalled();
        expect(sendMail).not.toHaveBeenCalled();
    });
});
