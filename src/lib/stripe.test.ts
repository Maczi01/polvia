/**
 * @jest-environment node
 */
import { isLiveStripeKey, STRIPE_LIVE_MODE } from './stripe';

jest.mock('../../env', () => ({ env: { STRIPE_SECRET_KEY: 'sk_live_dummy' } }));

describe('isLiveStripeKey', () => {
    it('klucz sekretny i ograniczony live to tryb produkcyjny', () => {
        expect(isLiveStripeKey('sk_live_abc')).toBe(true);
        expect(isLiveStripeKey('rk_live_abc')).toBe(true);
    });

    it('klucze testowe to nie tryb produkcyjny', () => {
        expect(isLiveStripeKey('sk_test_abc')).toBe(false);
        expect(isLiveStripeKey('rk_test_abc')).toBe(false);
    });
});

describe('STRIPE_LIVE_MODE', () => {
    it('wynika z klucza w env', () => {
        expect(STRIPE_LIVE_MODE).toBe(true);
    });
});
