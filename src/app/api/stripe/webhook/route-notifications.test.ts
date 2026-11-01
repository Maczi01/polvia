/**
 * @jest-environment node
 */
// Maile do foundera po `checkout.session.completed`: zakup, konflikt, limity czasu.
import { sendMail } from '@/lib/mailer';
import { NOTIFICATION_TIMEOUT_MS } from '@/lib/subscription-notifications';
import { type SubscriptionSyncResult, syncSubscriptionFromStripe } from '@/lib/subscription-sync';

import {
    CHECKOUT_COMPLETED,
    CONFLICT,
    event,
    invoiceObject,
    processedEvents,
    resetWebhookKit,
    SERVICE_ID,
    signedRequest,
} from '../../../../../tests/fixtures/premium/stripe-webhook-kit';
import { maxDuration, POST } from './route';

jest.mock(
    '../../../../../env',
    () =>
        jest.requireActual('../../../../../tests/fixtures/premium/stripe-webhook-kit')
            .fakeEnvModule,
);
jest.mock(
    '@/lib/stripe',
    () =>
        jest.requireActual('../../../../../tests/fixtures/premium/stripe-webhook-kit')
            .fakeStripeModule,
);
jest.mock(
    '@/lib/stripe-event-dedupe',
    () =>
        jest.requireActual('../../../../../tests/fixtures/premium/stripe-webhook-kit')
            .fakeDedupeModule,
);
jest.mock('@/lib/subscription-sync', () => ({ syncSubscriptionFromStripe: jest.fn() }));
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));

const SYNCED: SubscriptionSyncResult = {
    outcome: 'synced',
    serviceId: SERVICE_ID,
    isPremiumActive: true,
};

function signed(payload: string): Promise<Response> {
    return POST(signedRequest(payload));
}

function syncReturns(result: SubscriptionSyncResult): void {
    jest.mocked(syncSubscriptionFromStripe).mockResolvedValue(result);
}

beforeEach(() => {
    resetWebhookKit();
    jest.mocked(syncSubscriptionFromStripe).mockReset().mockResolvedValue(SYNCED);
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('POST /api/stripe/webhook — mail o zakupie', () => {
    it.each<SubscriptionSyncResult>([
        { outcome: 'synced', serviceId: SERVICE_ID, isPremiumActive: false },
        { outcome: 'stale_ignored', serviceId: SERVICE_ID },
    ])('wynik bez aktywnego premium (%o) nie wysyla maila o zakupie', async result => {
        syncReturns(result);

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(1);
        expect(processedEvents.has('evt_checkout')).toBe(true);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('POST /api/stripe/webhook — mail o konflikcie subskrypcji', () => {
    beforeEach(() => {
        syncReturns(CONFLICT);
    });

    it('pierwsze checkout.session.completed z konfliktem: jeden mail, o konflikcie, nie o zakupie', async () => {
        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(sendMail).toHaveBeenCalledTimes(1);
        const [message] = jest.mocked(sendMail).mock.calls[0] ?? [];
        expect(message?.to).toBe('founder@polvia.pl');
        // Tylko mail o konflikcie zawiera obie subskrypcje (zakup ma wylacznie swoja).
        expect(message?.text).toContain(CONFLICT.activeSubscriptionId);
        expect(message?.text).toContain(CONFLICT.conflictingSubscriptionId);
    });

    it('duplikat tego samego zdarzenia nie wysyla drugiego maila', async () => {
        await signed(CHECKOUT_COMPLETED);
        await signed(CHECKOUT_COMPLETED);

        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('rownolegle dostarczenie, ktore przegralo oznaczenie, nie wysyla maila', async () => {
        jest.mocked(syncSubscriptionFromStripe).mockImplementation(async () => {
            processedEvents.add('evt_checkout');
            return CONFLICT;
        });

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it.each([
        ['customer.subscription.updated', { id: 'sub_1', object: 'subscription' }],
        ['customer.subscription.created', { id: 'sub_1', object: 'subscription' }],
        ['invoice.paid', invoiceObject('sub_1')],
    ])('%s z konfliktem nie wysyla maila', async (type, object) => {
        const response = await signed(event(`evt_${type}`, type, object));

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(1);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('konflikt z nieoplacona druga subskrypcja nie wysyla maila', async () => {
        syncReturns({ ...CONFLICT, isIncomingActive: false });

        await signed(CHECKOUT_COMPLETED);

        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('POST /api/stripe/webhook — limity czasu maila', () => {
    it('zawieszony sendMail nie blokuje odpowiedzi ponad limit — handler zwraca 200', async () => {
        jest.useFakeTimers();
        jest.mocked(sendMail).mockReturnValue(new Promise(() => {}));

        const pending = signed(CHECKOUT_COMPLETED);
        await jest.advanceTimersByTimeAsync(NOTIFICATION_TIMEOUT_MS);
        const response = await pending;

        expect(response.status).toBe(200);
        expect(processedEvents.has('evt_checkout')).toBe(true);
        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'premium_purchased',
            result: 'timed_out',
        });
    });

    it('wolna synchronizacja: mail dostaje tylko reszte budzetu, odpowiedz przed maxDuration', async () => {
        jest.useFakeTimers();
        const SYNC_MS = 25_000;
        jest.mocked(syncSubscriptionFromStripe).mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve(SYNCED), SYNC_MS)),
        );
        jest.mocked(sendMail).mockReturnValue(new Promise(() => {}));
        let status: number | undefined;

        const pending = signed(CHECKOUT_COMPLETED).then(response => {
            status = response.status;
        });
        // Pelny limit maila (25 s + 8 s) przekroczylby maxDuration.
        await jest.advanceTimersByTimeAsync(maxDuration * 1000);

        expect(status).toBe(200);
        await pending;
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'premium_purchased',
            result: 'timed_out',
        });
    });

    it('nieudana wysylka maila nie zmienia odpowiedzi (200)', async () => {
        jest.mocked(sendMail).mockResolvedValue({ ok: false, code: 'SEND_FAILED' });

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'premium_purchased',
            result: 'failed',
        });
    });
});
