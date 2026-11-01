/**
 * @jest-environment node
 */
import { hasOnlyPremiumPrices, isPremiumPriceId } from './premium-prices';

jest.mock('../../env', () => ({
    env: { STRIPE_PRICE_MONTHLY: 'price_monthly', STRIPE_PRICE_YEARLY: 'price_yearly' },
}));

describe('isPremiumPriceId', () => {
    it('akceptuje cene miesieczna i roczna z env', () => {
        expect(isPremiumPriceId('price_monthly')).toBe(true);
        expect(isPremiumPriceId('price_yearly')).toBe(true);
    });

    it('odrzuca obca cene', () => {
        expect(isPremiumPriceId('price_other_product')).toBe(false);
    });
});

describe('hasOnlyPremiumPrices', () => {
    it('true, gdy wszystkie pozycje maja cene premium', () => {
        expect(hasOnlyPremiumPrices(['price_yearly'])).toBe(true);
    });

    it('false przy obcej pozycji obok ceny premium', () => {
        expect(hasOnlyPremiumPrices(['price_monthly', 'price_other_product'])).toBe(false);
    });

    it('false bez pozycji', () => {
        expect(hasOnlyPremiumPrices([])).toBe(false);
    });
});
