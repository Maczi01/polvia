/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';

import {
    DAY_MS,
    fakeStripeRetrieve,
    fakeSubscriptionDb as db,
    resetFakeSubscriptionDb,
    SERVICE_A,
    SERVICE_B,
    storedActive,
    stripeReturns,
    stripeSubscription,
    wholeSeconds,
} from '../../tests/fixtures/premium/fake-subscription-store';
import { syncSubscriptionFromStripe, syncSubscriptionSnapshot } from './subscription-sync';

/**
 * Allowlista cen, zrodlo stanu (retrieve vs obiekt z listy CLI) i powiazanie z wpisem.
 * Stripe, baza (za adapterem `subscription-store`) i SMTP to zewnetrzne serwisy.
 */
jest.mock('../../env', () => ({
    env: { STRIPE_PRICE_MONTHLY: 'price_monthly_test', STRIPE_PRICE_YEARLY: 'price_yearly_test' },
}));
jest.mock(
    '@/lib/stripe',
    () =>
        jest.requireActual('../../tests/fixtures/premium/fake-subscription-store').fakeStripeModule,
);
jest.mock(
    '@/lib/subscription-store',
    () =>
        jest.requireActual('../../tests/fixtures/premium/fake-subscription-store')
            .fakeSubscriptionStoreModule,
);
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));

beforeEach(() => {
    resetFakeSubscriptionDb();
    fakeStripeRetrieve.mockReset();
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('syncSubscriptionFromStripe — cena spoza allowlisty premium', () => {
    it('subskrypcja z obca cena nie daje premium, nawet ze wskazanym wpisem', async () => {
        stripeReturns(stripeSubscription({ priceId: 'price_other_product' }));

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'unlinked' });
        expect(db.subscriptions.size).toBe(0);
        expect(db.promotions.size).toBe(0);
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('premium price'),
            expect.objectContaining({ priceIds: ['price_other_product'] }),
        );
    });

    it('zmiana planu na obca cene nie przedluza premium powiazanego wpisu', async () => {
        const linked = storedActive(SERVICE_A, 'sub_A');
        db.subscriptions.set(SERVICE_A, linked);
        stripeReturns(
            stripeSubscription({
                priceId: 'price_other_product',
                periodEnd: wholeSeconds(Date.now() + 300 * DAY_MS),
            }),
        );

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'unlinked' });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(linked);
    });

    it('cena roczna z allowlisty daje premium', async () => {
        stripeReturns(stripeSubscription({ priceId: 'price_yearly_test' }));

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
    });
});

describe('zrodlo stanu', () => {
    it('syncSubscriptionFromStripe: stan ze swiezo pobranej subskrypcji (po id)', async () => {
        stripeReturns(stripeSubscription({}));

        await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(fakeStripeRetrieve).toHaveBeenCalledWith('sub_A');
    });

    it('syncSubscriptionSnapshot (CLI): stan z podanego obiektu, bez retrieve', async () => {
        const result = await syncSubscriptionSnapshot(stripeSubscription({}), {
            serviceId: SERVICE_A,
        });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(fakeStripeRetrieve).not.toHaveBeenCalled();
    });
});

describe('syncSubscriptionFromStripe — powiazanie z usluga', () => {
    it('bez wskazowki bierze usluge z istniejacego wiersza subskrypcji', async () => {
        db.subscriptions.set(SERVICE_B, storedActive(SERVICE_B, 'sub_A'));
        stripeReturns(stripeSubscription({ metadata: { serviceSlug: 'kancelaria-a' } }));

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_B, isPremiumActive: true });
    });

    it('po db:reset (nowe id uslug) wiaze po metadata.serviceSlug, nie po starym serviceId', async () => {
        const staleId = '99999999-9999-4999-8999-999999999999';
        stripeReturns(
            stripeSubscription({ metadata: { serviceId: staleId, serviceSlug: 'kancelaria-a' } }),
        );

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
    });

    it('fallback: metadata.serviceId, gdy brak slugu', async () => {
        stripeReturns(stripeSubscription({ metadata: { serviceId: SERVICE_B } }));

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_B, isPremiumActive: true });
    });

    it('client_reference_id spoza formatu UUID: log i dalszy lancuch (slug z metadanych)', async () => {
        stripeReturns(stripeSubscription({ metadata: { serviceSlug: 'kancelaria-a' } }));

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: 'nie-uuid' });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('client_reference_id'), {
            stripeSubscriptionId: 'sub_A',
        });
    });

    it('subskrypcja bez zadnego powiazania nie zapisuje niczego', async () => {
        stripeReturns(stripeSubscription({ metadata: { serviceId: 'nie-uuid' } }));

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'unlinked' });
        expect(db.subscriptions.size).toBe(0);
    });

    it('usluga, ktorej nie ma w bazie: nic nie zapisane, log z identyfikatorami', async () => {
        const missing = '33333333-3333-4333-8333-333333333333';
        stripeReturns(stripeSubscription({}));

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: missing });

        expect(result).toEqual({ outcome: 'service_missing', serviceId: missing });
        expect(db.subscriptions.size).toBe(0);
        expect(db.promotions.size).toBe(0);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('service not found'), {
            serviceId: missing,
            stripeSubscriptionId: 'sub_A',
        });
    });
});
