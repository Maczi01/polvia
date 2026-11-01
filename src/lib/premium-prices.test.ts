/**
 * @jest-environment node
 */
import { hasOnlyPremiumPrices, isPremiumPriceId } from './premium-prices';

/** Konfiguracja Stripe (z env) to granica zewnetrzna; getter, bo testy ja podmieniaja. */
const mockStripe: { config: { priceMonthly: string; priceYearly: string } | null } = {
    config: null,
};

jest.mock('@/lib/stripe', () => ({
    get stripeConfig() {
        return mockStripe.config;
    },
}));

beforeEach(() => {
    mockStripe.config = { priceMonthly: 'price_monthly', priceYearly: 'price_yearly' };
});

describe('isPremiumPriceId', () => {
    it('akceptuje cene miesieczna i roczna z env', () => {
        expect(isPremiumPriceId('price_monthly')).toBe(true);
        expect(isPremiumPriceId('price_yearly')).toBe(true);
    });

    it('odrzuca obca cene', () => {
        expect(isPremiumPriceId('price_other_product')).toBe(false);
    });

    it('bez konfiguracji Stripe zadna cena nie jest cena premium', () => {
        mockStripe.config = null;

        expect(isPremiumPriceId('price_monthly')).toBe(false);
        expect(hasOnlyPremiumPrices(['price_yearly'])).toBe(false);
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
