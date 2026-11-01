/**
 * @jest-environment node
 */
import Stripe from 'stripe';

import {
    CHECKOUT_SUCCESS_SUFFIX,
    createPremiumCheckoutSession,
    verifyPaidCheckoutSession,
} from './premium-checkout';
import type { PremiumCheckoutTarget } from './premium-checkout-queries';

/** Stripe i baza (za `premium-checkout-queries`) to zewnetrzne serwisy. */
const mockCreate = jest.fn();
const mockRetrieve = jest.fn();
const mockTargets = new Map<string, PremiumCheckoutTarget>();

jest.mock('../../env', () => ({
    env: {
        NEXT_PUBLIC_SITE_URL: 'https://polvia.pl',
        STRIPE_PRICE_MONTHLY: 'price_monthly_test',
        STRIPE_PRICE_YEARLY: 'price_yearly_test',
    },
}));
jest.mock('@/db', () => ({ db: {} }));
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

/**
 * Pozycje sesji (`expand: ['line_items']`) — do sprawdzenia ceny wystarcza `price.id`,
 * wiec fixture ma tylko ten ksztalt zamiast pelnego `Stripe.LineItem`.
 */
type LineItemsFixture = { data: Array<{ price: { id: string } | null }> };

function lineItems(...priceIds: string[]): LineItemsFixture {
    return { data: priceIds.map(id => ({ price: { id } })) };
}

type SessionFixture = Partial<Omit<Stripe.Checkout.Session, 'line_items'>> & {
    line_items?: LineItemsFixture;
};

function paidSession(overrides: SessionFixture = {}): SessionFixture {
    return {
        id: 'cs_test_paid',
        mode: 'subscription',
        status: 'complete',
        payment_status: 'paid',
        client_reference_id: SERVICE_ID,
        line_items: lineItems('price_monthly_test'),
        customer_details: {
            email: 'jan@firma.pl',
            name: 'Jan Kowalski',
            business_name: null,
            individual_name: null,
            address: {
                line1: 'Puławska 1',
                line2: null,
                postal_code: '00-001',
                city: 'Warszawa',
                country: 'PL',
                state: null,
            },
            phone: null,
            tax_exempt: 'none',
            tax_ids: [{ type: 'eu_vat', value: 'PL1234567890' }],
        },
        ...overrides,
    };
}

beforeEach(() => {
    mockCreate.mockReset();
    mockRetrieve.mockReset();
    mockTargets.clear();
    mockTargets.set(SERVICE_ID, TARGET);
    mockTargets.set(OTHER_SERVICE_ID, { ...TARGET, serviceId: OTHER_SERVICE_ID, slug: 'inna' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('createPremiumCheckoutSession', () => {
    it('sesja subskrypcji z cena z env, wpisem w client_reference_id i metadanych, w locale uk', async () => {
        mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });

        const url = await createPremiumCheckoutSession({
            target: TARGET,
            interval: 'yearly',
            locale: 'uk',
        });

        expect(url).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'subscription',
                line_items: [{ price: 'price_yearly_test', quantity: 1 }],
                client_reference_id: SERVICE_ID,
                subscription_data: {
                    metadata: { serviceId: SERVICE_ID, serviceSlug: 'mistrz-remontu' },
                },
                tax_id_collection: { enabled: true },
                billing_address_collection: 'required',
                success_url: `https://polvia.pl/uk/firma/mistrz-remontu${CHECKOUT_SUCCESS_SUFFIX}`,
                cancel_url: 'https://polvia.pl/uk/firma/mistrz-remontu',
            }),
        );
    });

    it('pl bez prefiksu locale i cena miesieczna', async () => {
        mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_2' });

        await createPremiumCheckoutSession({ target: TARGET, interval: 'monthly', locale: 'pl' });

        const params = mockCreate.mock.calls[0][0];
        expect(params.line_items).toEqual([{ price: 'price_monthly_test', quantity: 1 }]);
        expect(params.cancel_url).toBe('https://polvia.pl/firma/mistrz-remontu');
        expect(params.success_url).not.toContain('/en/');
    });

    it('blad Stripe daje null, a szczegoly zostaja w logu', async () => {
        mockCreate.mockRejectedValue(new Error('api_key sk_live_secret invalid'));

        expect(
            await createPremiumCheckoutSession({
                target: TARGET,
                interval: 'monthly',
                locale: 'pl',
            }),
        ).toBeNull();
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('sk_live');
    });
});

describe('verifyPaidCheckoutSession', () => {
    it('oplacona sesja tego wpisu: cel i dane platnika', async () => {
        mockRetrieve.mockResolvedValue(paidSession());

        expect(await verifyPaidCheckoutSession('cs_test_paid', 'mistrz-remontu')).toEqual({
            status: 'paid',
            target: TARGET,
            payer: {
                email: 'jan@firma.pl',
                name: 'Jan Kowalski',
                taxIds: ['eu_vat PL1234567890'],
                address: 'Puławska 1, 00-001, Warszawa, PL',
            },
        });
    });

    it('pobiera sesje z pozycjami (do sprawdzenia ceny)', async () => {
        mockRetrieve.mockResolvedValue(paidSession());

        await verifyPaidCheckoutSession('cs_test_paid', 'mistrz-remontu');

        expect(mockRetrieve).toHaveBeenCalledWith('cs_test_paid', { expand: ['line_items'] });
    });

    it('oplacona sesja z cena roczna premium jest wazna', async () => {
        mockRetrieve.mockResolvedValue(paidSession({ line_items: lineItems('price_yearly_test') }));

        expect(await verifyPaidCheckoutSession('cs_test_paid', 'mistrz-remontu')).toMatchObject({
            status: 'paid',
        });
    });

    it('oplacona sesja z obca cena (inny Payment Link na koncie) jest niewazna', async () => {
        mockRetrieve.mockResolvedValue(
            paidSession({ line_items: lineItems('price_other_product') }),
        );

        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'invalid',
        });
    });

    it('sesja z obca pozycja obok ceny premium albo bez pozycji jest niewazna', async () => {
        mockRetrieve.mockResolvedValue(
            paidSession({ line_items: lineItems('price_monthly_test', 'price_other_product') }),
        );
        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'invalid',
        });

        mockRetrieve.mockResolvedValue(paidSession({ line_items: undefined }));
        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'invalid',
        });
    });

    it('sesja nieoplacona albo niezakonczona jest niewazna', async () => {
        mockRetrieve.mockResolvedValue(paidSession({ payment_status: 'unpaid' }));
        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'invalid',
        });

        mockRetrieve.mockResolvedValue(paidSession({ status: 'open' }));
        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'invalid',
        });
    });

    it('sesja innego wpisu niz slug z adresu jest niewazna', async () => {
        mockRetrieve.mockResolvedValue(paidSession({ client_reference_id: OTHER_SERVICE_ID }));

        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'invalid',
        });
    });

    it('nieistniejaca sesja jest niewazna, a awaria Stripe to "unavailable"', async () => {
        mockRetrieve.mockRejectedValueOnce(
            new Stripe.errors.StripeInvalidRequestError({
                type: 'invalid_request_error',
                message: 'No such checkout.session',
            }),
        );
        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'invalid',
        });

        mockRetrieve.mockRejectedValueOnce(new Error('ETIMEDOUT'));
        expect(await verifyPaidCheckoutSession('cs_test_x', 'mistrz-remontu')).toEqual({
            status: 'unavailable',
        });
    });
});
