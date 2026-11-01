/**
 * @jest-environment node
 */
import { sendMail } from '@/lib/mailer';
import { PREMIUM_GRACE_DAYS } from '@/lib/premium';
import type { SubscriptionRecord } from '@/lib/subscription-store';

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
import { syncSubscriptionFromStripe } from './subscription-sync';

/** Stripe, baza (za adapterem `subscription-store`) i SMTP to zewnetrzne serwisy. */
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

const SECOND_PAID_LOG = 'second paid subscription';

/** Zdarzenie subskrypcji bez wskazowki (np. `invoice.*`): wiaze po zapisie albo slugu. */
function syncEvent(
    id: string,
    status: string,
    overrides: { periodStart?: Date } = {},
): ReturnType<typeof syncSubscriptionFromStripe> {
    stripeReturns(
        stripeSubscription({ id, status, metadata: { serviceSlug: 'kancelaria-a' }, ...overrides }),
    );
    return syncSubscriptionFromStripe(id);
}

function paidConflictLogged(): boolean {
    return jest
        .mocked(console.warn)
        .mock.calls.some(([message]) => String(message).includes(SECOND_PAID_LOG));
}

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

describe('druga subskrypcja dla jednego wpisu', () => {
    it('aktywna druga nie nadpisuje aktywnej pierwszej; konflikt oplacony w wyniku i w logu, bez maila', async () => {
        const first = storedActive(SERVICE_A, 'sub_first');
        db.subscriptions.set(SERVICE_A, first);
        db.promotions.set(SERVICE_A, PERIOD_END);
        stripeReturns(stripeSubscription({ id: 'sub_second', status: 'active' }));

        const result = await syncSubscriptionFromStripe('sub_second', { serviceId: SERVICE_A });

        expect(result).toEqual({
            outcome: 'conflict',
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_first',
            conflictingSubscriptionId: 'sub_second',
            isIncomingActive: true,
        });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(first);
        expect(db.promotions.get(SERVICE_A)).toEqual(PERIOD_END);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(SECOND_PAID_LOG), {
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_first',
            conflictingSubscriptionId: 'sub_second',
        });
        // Mail o konflikcie wysyla webhook raz na checkout (route-notifications.test.ts).
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('nieaktywna druga subskrypcja nie nadpisuje stanu; konflikt bez oplaty', async () => {
        const first = storedActive(SERVICE_A, 'sub_first');
        db.subscriptions.set(SERVICE_A, first);
        stripeReturns(stripeSubscription({ id: 'sub_second', status: 'canceled' }));

        const result = await syncSubscriptionFromStripe('sub_second', { serviceId: SERVICE_A });

        expect(result).toEqual({
            outcome: 'conflict',
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_first',
            conflictingSubscriptionId: 'sub_second',
            isIncomingActive: false,
        });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(first);
        expect(paidConflictLogged()).toBe(false);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('nowa subskrypcja po wygasnieciu poprzedniej zastepuje ja', async () => {
        db.subscriptions.set(SERVICE_A, {
            ...storedActive(SERVICE_A, 'sub_old'),
            status: 'canceled',
        });
        stripeReturns(stripeSubscription({ id: 'sub_new', status: 'active' }));

        const result = await syncSubscriptionFromStripe('sub_new', { serviceId: SERVICE_A });

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)?.stripeSubscriptionId).toBe('sub_new');
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('nowy zakup w karencji past_due starej subskrypcji (R3: obrona na wyscig)', () => {
    const renewalFailedAt = wholeSeconds(Date.now() - DAY_MS);
    const oldPastDue: SubscriptionRecord = {
        ...storedActive(SERVICE_A, 'sub_old'),
        status: 'past_due',
        currentPeriodStart: renewalFailedAt,
        currentPeriodEnd: wholeSeconds(Date.now() + 29 * DAY_MS),
    };
    const newRow: SubscriptionRecord = {
        serviceId: SERVICE_A,
        stripeSubscriptionId: 'sub_new',
        stripeCustomerId: 'cus_A',
        status: 'active',
        currentPeriodStart: PERIOD_START,
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
    };
    const newRanking = rankingUntil(PERIOD_END, PREMIUM_GRACE_DAYS);

    beforeEach(() => {
        db.subscriptions.set(SERVICE_A, oldPastDue);
        db.promotions.set(SERVICE_A, rankingUntil(renewalFailedAt, PREMIUM_GRACE_DAYS));
    });

    it('oplacona nowa wypiera zapisana past_due: zapis, premium, ranking, bez konfliktu', async () => {
        const result = await syncEvent('sub_new', 'active');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(newRow);
        expect(db.promotions.get(SERVICE_A)).toEqual(newRanking);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('replaces past_due'), {
            serviceId: SERVICE_A,
            stripeSubscriptionId: 'sub_new',
            replacedSubscriptionId: 'sub_old',
        });
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('trialing nowej tez wypiera past_due', async () => {
        const result = await syncEvent('sub_new', 'trialing');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)?.stripeSubscriptionId).toBe('sub_new');
    });

    it('pozniejsze anulowanie starej nie zmienia wiersza nowej (konflikt bez oplaty)', async () => {
        await syncEvent('sub_new', 'active');

        const result = await syncEvent('sub_old', 'canceled');

        expect(result).toEqual({
            outcome: 'conflict',
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_new',
            conflictingSubscriptionId: 'sub_old',
            isIncomingActive: false,
        });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(newRow);
        expect(db.promotions.get(SERVICE_A)).toEqual(newRanking);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('invoice.payment_failed starej (past_due w karencji) po wyparciu: konflikt bez logu podwojnej oplaty', async () => {
        await syncEvent('sub_new', 'active');

        const result = await syncEvent('sub_old', 'past_due', { periodStart: renewalFailedAt });

        expect(result).toEqual({
            outcome: 'conflict',
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_new',
            conflictingSubscriptionId: 'sub_old',
            isIncomingActive: false,
        });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(newRow);
        expect(paidConflictLogged()).toBe(false);
    });

    it('stara odzyskuje platnosc po wyparciu (past_due → active): konflikt oplacony, wiersz nowej bez zmian, log', async () => {
        await syncEvent('sub_new', 'active');

        const result = await syncEvent('sub_old', 'active');

        expect(result).toEqual({
            outcome: 'conflict',
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_new',
            conflictingSubscriptionId: 'sub_old',
            isIncomingActive: true,
        });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(newRow);
        expect(db.promotions.get(SERVICE_A)).toEqual(newRanking);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(SECOND_PAID_LOG), {
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_new',
            conflictingSubscriptionId: 'sub_old',
        });
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('nieoplacona nowa (incomplete) nie wypiera past_due; po oplaceniu (active) wypiera', async () => {
        const pending = await syncEvent('sub_new', 'incomplete');

        expect(pending).toEqual({
            outcome: 'conflict',
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_old',
            conflictingSubscriptionId: 'sub_new',
            isIncomingActive: false,
        });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(oldPastDue);

        const paid = await syncEvent('sub_new', 'active');

        expect(paid).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(newRow);
    });

    it('dwie nowe po sobie: pierwsza wypiera past_due, druga to konflikt z pierwsza', async () => {
        await syncEvent('sub_new', 'active');

        const result = await syncEvent('sub_third', 'active');

        expect(result).toEqual({
            outcome: 'conflict',
            serviceId: SERVICE_A,
            activeSubscriptionId: 'sub_new',
            conflictingSubscriptionId: 'sub_third',
            isIncomingActive: true,
        });
        expect(db.subscriptions.get(SERVICE_A)).toEqual(newRow);
        expect(paidConflictLogged()).toBe(true);
    });

    it('ta sama past_due, ktora odzyskuje platnosc (bez nowej): zapis active i ranking', async () => {
        const result = await syncEvent('sub_old', 'active');

        expect(result).toEqual({ outcome: 'synced', serviceId: SERVICE_A, isPremiumActive: true });
        expect(db.subscriptions.get(SERVICE_A)?.status).toBe('active');
        expect(db.promotions.get(SERVICE_A)).toEqual(newRanking);
    });
});
