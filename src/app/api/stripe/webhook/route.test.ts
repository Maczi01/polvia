/**
 * @jest-environment node
 */
// Request/Response wymagaja fetch API, ktorego jsdom nie ma.
import { sendMail } from '@/lib/mailer';
import { syncSubscriptionFromStripe } from '@/lib/subscription-sync';

import {
    CHECKOUT_COMPLETED,
    event,
    invoiceObject,
    processedEvents,
    resetWebhookKit,
    SERVICE_ID,
    signatureFor,
    signedRequest,
    SUBSCRIPTION_UPDATED,
    webhookRequest,
} from '../../../../../tests/fixtures/premium/stripe-webhook-kit';
import { POST } from './route';

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

function signed(payload: string, secret?: string): Promise<Response> {
    return POST(signedRequest(payload, secret));
}

beforeEach(() => {
    resetWebhookKit();
    jest.mocked(syncSubscriptionFromStripe)
        .mockReset()
        .mockResolvedValue({ outcome: 'synced', serviceId: SERVICE_ID, isPremiumActive: true });
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('POST /api/stripe/webhook — podpis', () => {
    it('bez naglowka stripe-signature daje 400 i nie synchronizuje', async () => {
        const response = await POST(webhookRequest(SUBSCRIPTION_UPDATED));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            data: null,
            error: { code: 'MISSING_SIGNATURE', message: expect.any(String) },
        });
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });

    it('podpis innym sekretem daje 400 i nie synchronizuje', async () => {
        const response = await signed(SUBSCRIPTION_UPDATED, 'whsec_attacker');

        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('INVALID_SIGNATURE');
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });

    it('zmieniona tresc po podpisaniu daje 400', async () => {
        const signature = signatureFor(SUBSCRIPTION_UPDATED);

        const response = await POST(
            webhookRequest(SUBSCRIPTION_UPDATED.replace('sub_1', 'sub_2'), signature),
        );

        expect(response.status).toBe(400);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });

    it('smieciowy naglowek daje 400', async () => {
        const response = await POST(webhookRequest(SUBSCRIPTION_UPDATED, 'garbage'));

        expect(response.status).toBe(400);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });
});

describe('POST /api/stripe/webhook — routing zdarzen', () => {
    it.each([
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ])('%s synchronizuje subskrypcje ze zdarzenia, bez maila', async type => {
        const response = await signed(
            event(`evt_${type}`, type, { id: 'sub_1', object: 'subscription' }),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: { received: true }, error: null });
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', {});
        expect(processedEvents.has(`evt_${type}`)).toBe(true);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it.each(['invoice.paid', 'invoice.payment_failed'])(
        '%s synchronizuje subskrypcje z faktury, bez maila',
        async type => {
            const response = await signed(event(`evt_${type}`, type, invoiceObject('sub_9')));

            expect(response.status).toBe(200);
            expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_9', {});
            expect(sendMail).not.toHaveBeenCalled();
        },
    );

    it('checkout.session.completed wiaze wpis z client_reference_id i powiadamia foundera', async () => {
        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', { serviceId: SERVICE_ID });
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(jest.mocked(sendMail).mock.calls[0]?.[0].text).toContain(SERVICE_ID);
    });

    it('nieobslugiwane zdarzenie daje 200 bez synchronizacji', async () => {
        const response = await signed(event('evt_other', 'customer.created', { id: 'cus_1' }));

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });

    it('checkout platnosci jednorazowej (bez subskrypcji) nie synchronizuje', async () => {
        const payload = event('evt_payment', 'checkout.session.completed', {
            id: 'cs_2',
            mode: 'payment',
            subscription: null,
        });

        const response = await signed(payload);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });
});

describe('POST /api/stripe/webhook — deduplikacja i awarie', () => {
    it('to samo event.id dwa razy: druga odpowiedz 200, synchronizacja i mail raz', async () => {
        const first = await signed(CHECKOUT_COMPLETED);
        const second = await signed(CHECKOUT_COMPLETED);

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(1);
        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('rownolegly duplikat, ktory przegral oznaczenie (markStripeEventProcessed → false): 200 bez maila o zakupie', async () => {
        // Inne dostarczenie tego samego zdarzenia oznaczylo je miedzy sprawdzeniem a zapisem.
        jest.mocked(syncSubscriptionFromStripe).mockImplementation(async () => {
            processedEvents.add('evt_checkout');
            return { outcome: 'synced', serviceId: SERVICE_ID, isPremiumActive: true };
        });

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(1);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('blad synchronizacji daje 500 bez szczegolow, a zdarzenie zostaje nieoznaczone', async () => {
        jest.mocked(syncSubscriptionFromStripe).mockRejectedValueOnce(
            new Error('connection to db.internal:5432 refused'),
        );

        const failed = await signed(CHECKOUT_COMPLETED);

        expect(failed.status).toBe(500);
        const body = await failed.json();
        expect(body).toEqual({
            data: null,
            error: { code: 'SYNC_FAILED', message: expect.any(String) },
        });
        expect(JSON.stringify(body)).not.toContain('db.internal');
        expect(processedEvents.has('evt_checkout')).toBe(false);
        expect(sendMail).not.toHaveBeenCalled();

        const retried = await signed(CHECKOUT_COMPLETED);

        expect(retried.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(2);
        expect(processedEvents.has('evt_checkout')).toBe(true);
    });
});
