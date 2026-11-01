import { verifyPaidCheckoutSession } from '@/lib/premium-checkout';
import { checkRateLimitWithTimeout } from '@/lib/rate-limit';

import PremiumThanksPage from './page';

/**
 * Platnosci online wylaczone (brak zmiennych `STRIPE_*`): strona po platnosci nie istnieje —
 * `notFound()` przed limitem i przed Stripe. Granice zewnetrzne jak w `page.test.tsx`.
 */
class MockNotFoundSignal extends Error {}

jest.mock('@/lib/stripe', () => ({ stripeConfig: null }));
jest.mock('next/navigation', () => ({
    notFound: () => {
        throw new MockNotFoundSignal('NEXT_NOT_FOUND');
    },
}));
jest.mock('@/lib/premium-checkout', () => ({ verifyPaidCheckoutSession: jest.fn() }));
jest.mock('@/lib/redis', () => ({ redis: {} }));
jest.mock('@/lib/rate-limit', () => ({
    ...jest.requireActual('@/lib/rate-limit'),
    checkRateLimitWithTimeout: jest.fn(),
}));
jest.mock('@/lib/premium-materials-sent', () => ({ isMaterialsSent: jest.fn() }));
jest.mock('next/headers', () => ({ headers: async () => new Headers() }));
jest.mock('@/lib/mailer', () => ({ getOperatorInbox: () => 'kontakt@example.com' }));
jest.mock('../../_actions', () => ({ submitPremiumMaterials: jest.fn() }));
jest.mock('next-intl/server', () => ({
    getTranslations: async () => (key: string) => key,
    setRequestLocale: () => {},
}));

describe('PremiumThanksPage bez konfiguracji Stripe', () => {
    it('daje 404 (notFound) i nie pyta limitu ani Stripe', async () => {
        const page = PremiumThanksPage({
            params: Promise.resolve({ locale: 'pl', slug: 'kancelaria-nowak' }),
            searchParams: Promise.resolve({ session_id: 'cs_test_a1B2c3D4e5F6g7H8' }),
        });

        await expect(page).rejects.toThrow(MockNotFoundSignal);
        expect(checkRateLimitWithTimeout).not.toHaveBeenCalled();
        expect(verifyPaidCheckoutSession).not.toHaveBeenCalled();
    });
});
