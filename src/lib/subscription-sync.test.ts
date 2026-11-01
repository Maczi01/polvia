/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';
import { PREMIUM_GRACE_DAYS } from '@/lib/premium';

import {
    DAY_MS,
    fakeStripeRetrieve,
    fakeSubscriptionDb as db,
    PERIOD_END,
    PERIOD_START,
    rankingUntil,
    resetFakeSubscriptionDb,
    SERVICE_A,
    storedActive,
    stripeReturns,
    stripeSubscription,
    wholeSeconds,
} from '../../tests/fixtures/premium/fake-subscription-store';
import { SubscriptionSyncError, syncSubscriptionFromStripe } from './subscription-sync';

/** Stripe, baza (za adapterem `subscription-store`) i SMTP to zewnetrzne serwisy. */
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

describe('syncSubscriptionFromStripe — stan subskrypcji', () => {
    it('active: zapisuje stan i ustawia ranking do currentPeriodEnd + karencja', async () => {
        stripeReturns(stripeSubscription({ status: 'active' }));

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)).toEqual({
            serviceId: SERVICE_A,
            stripeSubscriptionId: 'sub_A',
            stripeCustomerId: 'cus_A',
            status: 'active',
            currentPeriodStart: PERIOD_START,
            currentPeriodEnd: PERIOD_END,
            cancelAtPeriodEnd: false,
        });
        expect(db.promotions.get(SERVICE_A)).toEqual(rankingUntil(PERIOD_END, PREMIUM_GRACE_DAYS));
    });

    it('trialing daje premium i ranking jak active', async () => {
        stripeReturns(stripeSubscription({ status: 'trialing' }));

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.promotions.get(SERVICE_A)).toEqual(rankingUntil(PERIOD_END, PREMIUM_GRACE_DAYS));
    });

    it('wiele pozycji: okres od najpozniejszego startu do najpozniejszego konca', async () => {
        const laterStart = wholeSeconds(Date.now() - 2 * DAY_MS);
        const laterEnd = wholeSeconds(Date.now() + 40 * DAY_MS);
        stripeReturns(
            stripeSubscription({
                items: [
                    { start: laterStart, end: PERIOD_END },
                    { start: PERIOD_START, end: laterEnd },
                ],
            }),
        );

        await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(db.subscriptions.get(SERVICE_A)).toMatchObject({
            currentPeriodStart: laterStart,
            currentPeriodEnd: laterEnd,
        });
        expect(db.promotions.get(SERVICE_A)).toEqual(rankingUntil(laterEnd, PREMIUM_GRACE_DAYS));
    });

    it('canceled: usuwa wpis z promoted_services, stan zapisany jako canceled', async () => {
        db.subscriptions.set(SERVICE_A, storedActive(SERVICE_A, 'sub_A'));
        db.promotions.set(SERVICE_A, PERIOD_END);
        stripeReturns(stripeSubscription({ status: 'canceled' }));

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: false });
        expect(db.promotions.has(SERVICE_A)).toBe(false);
        expect(db.subscriptions.get(SERVICE_A)?.status).toBe('canceled');
    });

    it('past_due po karencji zdejmuje z rankingu, choc przesuniety okres trwa', async () => {
        // Stripe przesuwa okres przed nieudanym odnowieniem: start = nieudane odnowienie.
        stripeReturns(
            stripeSubscription({
                status: 'past_due',
                periodStart: wholeSeconds(Date.now() - (PREMIUM_GRACE_DAYS + 1) * DAY_MS),
                periodEnd: wholeSeconds(Date.now() + 26 * DAY_MS),
            }),
        );

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: false });
        expect(db.promotions.has(SERVICE_A)).toBe(false);
    });

    it('past_due w karencji: ranking do poczatku okresu + karencja, nie do nowego konca', async () => {
        const renewalFailedAt = wholeSeconds(Date.now() - DAY_MS);
        stripeReturns(
            stripeSubscription({
                status: 'past_due',
                periodStart: renewalFailedAt,
                periodEnd: wholeSeconds(Date.now() + 29 * DAY_MS),
            }),
        );

        const result = await syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)?.currentPeriodStart).toEqual(renewalFailedAt);
        expect(db.promotions.get(SERVICE_A)).toEqual(
            rankingUntil(renewalFailedAt, PREMIUM_GRACE_DAYS),
        );
    });

    it('past_due po karencji, potem oplacone (active): premium i ranking wracaja', async () => {
        db.subscriptions.set(SERVICE_A, {
            ...storedActive(SERVICE_A, 'sub_A'),
            status: 'past_due',
            currentPeriodStart: wholeSeconds(Date.now() - (PREMIUM_GRACE_DAYS + 1) * DAY_MS),
        });
        stripeReturns(stripeSubscription({ status: 'active' }));

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)?.status).toBe('active');
        expect(db.promotions.get(SERVICE_A)).toEqual(rankingUntil(PERIOD_END, PREMIUM_GRACE_DAYS));
    });
});

describe('syncSubscriptionFromStripe — stan koncowy a nieswiezy odczyt', () => {
    it('po zapisanym canceled starszy past_due tej samej subskrypcji: stale_ignored, bez premium', async () => {
        // Wyscig: `retrieve` jest przed blokada, wiec past_due pobrany przed anulowaniem
        // moze dotrzec do transakcji po zapisie canceled.
        db.subscriptions.set(SERVICE_A, {
            ...storedActive(SERVICE_A, 'sub_A'),
            status: 'canceled',
        });
        stripeReturns(
            stripeSubscription({
                status: 'past_due',
                periodStart: wholeSeconds(Date.now() - DAY_MS),
            }),
        );

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'stale_ignored', serviceId: SERVICE_A });
        expect(db.subscriptions.get(SERVICE_A)?.status).toBe('canceled');
        expect(db.promotions.has(SERVICE_A)).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('stale state'), {
            stripeSubscriptionId: 'sub_A',
            incomingStatus: 'past_due',
        });
    });

    it('incomplete po zapisanym incomplete_expired tej samej subskrypcji: stale_ignored', async () => {
        db.subscriptions.set(SERVICE_A, {
            ...storedActive(SERVICE_A, 'sub_A'),
            status: 'incomplete_expired',
        });
        stripeReturns(stripeSubscription({ status: 'incomplete' }));

        const result = await syncSubscriptionFromStripe('sub_A');

        expect(result).toEqual({ outcome: 'stale_ignored', serviceId: SERVICE_A });
        expect(db.subscriptions.get(SERVICE_A)?.status).toBe('incomplete_expired');
    });
});

describe('syncSubscriptionFromStripe — bledy', () => {
    it('blad Stripe przechodzi wyzej i niczego nie zapisuje', async () => {
        fakeStripeRetrieve.mockRejectedValue(new Error('timeout'));

        await expect(syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A })).rejects.toThrow(
            'timeout',
        );
        expect(db.subscriptions.size).toBe(0);
    });

    it('nieznany status Stripe to typowany blad UNSUPPORTED_STATUS', async () => {
        stripeReturns(stripeSubscription({ status: 'frozen' }));

        await expect(syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A })).rejects.toEqual(
            new SubscriptionSyncError('UNSUPPORTED_STATUS', 'sub_A'),
        );
        expect(db.subscriptions.size).toBe(0);
    });

    it('subskrypcja bez pozycji (brak konca okresu) to blad MISSING_PERIOD', async () => {
        stripeReturns(stripeSubscription({ items: [] }));

        await expect(
            syncSubscriptionFromStripe('sub_A', { serviceId: SERVICE_A }),
        ).rejects.toMatchObject({ code: 'MISSING_PERIOD' });
    });
});
