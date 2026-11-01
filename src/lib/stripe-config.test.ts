/**
 * @jest-environment node
 */
import { resolveStripeConfig, STRIPE_ENV_KEYS, StripePartialConfigError } from './stripe-config';

const FULL = {
    STRIPE_SECRET_KEY: 'sk_live_abc',
    STRIPE_WEBHOOK_SECRET: 'whsec_abc',
    STRIPE_PRICE_MONTHLY: 'price_monthly',
    STRIPE_PRICE_YEARLY: 'price_yearly',
    STRIPE_PORTAL_LOGIN_URL: 'https://billing.stripe.com/p/login/abc',
};

describe('resolveStripeConfig', () => {
    it('komplet zmiennych daje konfiguracje', () => {
        expect(resolveStripeConfig(FULL)).toEqual({
            secretKey: 'sk_live_abc',
            webhookSecret: 'whsec_abc',
            priceMonthly: 'price_monthly',
            priceYearly: 'price_yearly',
            portalLoginUrl: 'https://billing.stripe.com/p/login/abc',
        });
    });

    it('brak wszystkich zmiennych: Stripe wylaczony (null), bez bledu', () => {
        expect(resolveStripeConfig({})).toBeNull();
        expect(resolveStripeConfig({ STRIPE_SECRET_KEY: undefined })).toBeNull();
    });

    it('pusty string liczy sie jak brak zmiennej', () => {
        expect(resolveStripeConfig({ STRIPE_SECRET_KEY: '' })).toBeNull();
    });

    it.each(STRIPE_ENV_KEYS)('czesciowa konfiguracja bez %s to blad z nazwa brakujacej', key => {
        const partial = { ...FULL, [key]: undefined };

        expect(() => resolveStripeConfig(partial)).toThrow(StripePartialConfigError);
        expect(() => resolveStripeConfig(partial)).toThrow(key);
    });

    it('jedna zmienna bez reszty to blad z lista czterech brakujacych', () => {
        let caught: unknown;
        try {
            resolveStripeConfig({ STRIPE_SECRET_KEY: 'sk_test_abc' });
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(StripePartialConfigError);
        expect(caught instanceof StripePartialConfigError && caught.missingKeys).toEqual([
            'STRIPE_WEBHOOK_SECRET',
            'STRIPE_PRICE_MONTHLY',
            'STRIPE_PRICE_YEARLY',
            'STRIPE_PORTAL_LOGIN_URL',
        ]);
    });
});
