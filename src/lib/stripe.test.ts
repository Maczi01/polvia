/**
 * @jest-environment node
 */
import type { StripeEnv } from './stripe-config';

/** `env` to granica zewnetrzna; kazdy test laduje modul od nowa z wlasnym zestawem zmiennych. */
const mockEnv: { env: StripeEnv } = { env: {} };

jest.mock('../../env', () => ({
    get env() {
        return mockEnv.env;
    },
}));

const FULL: StripeEnv = {
    STRIPE_SECRET_KEY: 'sk_live_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
    STRIPE_PRICE_MONTHLY: 'price_monthly',
    STRIPE_PRICE_YEARLY: 'price_yearly',
    STRIPE_PORTAL_LOGIN_URL: 'https://billing.example.com/login',
};

type StripeModule = typeof import('./stripe');

function loadStripeModule(vars: StripeEnv): StripeModule {
    mockEnv.env = vars;
    let loaded: StripeModule | undefined;
    jest.isolateModules(() => {
        loaded = jest.requireActual<StripeModule>('./stripe');
    });
    if (!loaded) throw new Error('modul stripe nie zaladowal sie');
    return loaded;
}

describe('isLiveStripeKey', () => {
    const { isLiveStripeKey } = loadStripeModule(FULL);

    it('klucz sekretny i ograniczony live to tryb produkcyjny', () => {
        expect(isLiveStripeKey('sk_live_abc')).toBe(true);
        expect(isLiveStripeKey('rk_live_abc')).toBe(true);
    });

    it('klucze testowe to nie tryb produkcyjny', () => {
        expect(isLiveStripeKey('sk_test_abc')).toBe(false);
        expect(isLiveStripeKey('rk_test_abc')).toBe(false);
    });
});

describe('konfiguracja Stripe', () => {
    it('komplet zmiennych: wlaczony, tryb z klucza, klient tworzony leniwie i wspolny', () => {
        const stripe = loadStripeModule(FULL);

        expect(stripe.isStripeConfigured).toBe(true);
        expect(stripe.STRIPE_LIVE_MODE).toBe(true);
        expect(stripe.STRIPE_KEY_MODE).toBe('live');
        expect(stripe.requireStripeConfig().priceYearly).toBe('price_yearly');
        expect(stripe.getStripe()).toBe(stripe.getStripe());
    });

    it('klucz testowy: tryb test', () => {
        const stripe = loadStripeModule({ ...FULL, STRIPE_SECRET_KEY: 'sk_test_dummy' });

        expect(stripe.STRIPE_KEY_MODE).toBe('test');
        expect(stripe.STRIPE_LIVE_MODE).toBe(false);
    });

    it('bez zmiennych: import nie rzuca, Stripe wylaczony, klient to typowany blad', () => {
        const stripe = loadStripeModule({});

        expect(stripe.isStripeConfigured).toBe(false);
        expect(stripe.stripeConfig).toBeNull();
        expect(stripe.STRIPE_KEY_MODE).toBeNull();
        expect(stripe.STRIPE_LIVE_MODE).toBe(false);
        expect(() => stripe.getStripe()).toThrow(stripe.StripeNotConfiguredError);
        expect(() => stripe.requireStripeConfig()).toThrow(stripe.StripeNotConfiguredError);
    });
});
