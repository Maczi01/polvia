/**
 * @jest-environment node
 */
// Request/Response wymagaja fetch API, ktorego jsdom nie ma.
import Stripe from 'stripe';

import { sendMail } from '@/lib/mailer';
import { NOTIFICATION_TIMEOUT_MS } from '@/lib/subscription-notifications';
import { syncSubscriptionFromStripe } from '@/lib/subscription-sync';

import { POST } from './route';

const WEBHOOK_SECRET = 'whsec_test_secret';

/** Baza (tabela `stripe_events`) jako zbior w pamieci. */
const mockProcessedEvents = new Set<string>();

jest.mock('../../../../../env', () => ({ env: { STRIPE_WEBHOOK_SECRET: 'whsec_test_secret' } }));
// Prawdziwa weryfikacja podpisu z paczki `stripe` (lokalne HMAC, bez sieci).
jest.mock('@/lib/stripe', () => {
    // Build CJS paczki eksportuje konstruktor jako `module.exports` (bez `default`).
    const StripeClient = jest.requireActual<typeof Stripe>('stripe');
    return { stripe: new StripeClient('sk_test_dummy') };
});
jest.mock('@/lib/stripe-events', () => ({
    isStripeEventProcessed: async (id: string) => mockProcessedEvents.has(id),
    markStripeEventProcessed: async ({ id }: { id: string }) => {
        if (mockProcessedEvents.has(id)) return false;
        mockProcessedEvents.add(id);
        return true;
    },
}));
jest.mock('@/lib/subscription-sync', () => ({ syncSubscriptionFromStripe: jest.fn() }));
jest.mock('@/lib/mailer', () => ({
    sendMail: jest.fn(),
    getOperatorInbox: () => 'founder@polvia.pl',
}));

const signer = new Stripe('sk_test_dummy');
const SERVICE_ID = '11111111-1111-4111-8111-111111111111';

function event(id: string, type: string, object: Record<string, unknown>): string {
    return JSON.stringify({ id, object: 'event', type, data: { object } });
}

function deliver(payload: string, signature?: string): Promise<Response> {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (signature !== undefined) headers.set('stripe-signature', signature);
    return POST(
        new Request('https://www.polvia.pl/api/stripe/webhook', {
            method: 'POST',
            body: payload,
            headers,
        }),
    );
}

function signed(payload: string, secret = WEBHOOK_SECRET): Promise<Response> {
    return deliver(payload, signer.webhooks.generateTestHeaderString({ payload, secret }));
}

const SUBSCRIPTION_UPDATED = event('evt_sub_updated', 'customer.subscription.updated', {
    id: 'sub_1',
    object: 'subscription',
});

const CHECKOUT_COMPLETED = event('evt_checkout', 'checkout.session.completed', {
    id: 'cs_1',
    object: 'checkout.session',
    mode: 'subscription',
    subscription: 'sub_1',
    client_reference_id: SERVICE_ID,
});

beforeEach(() => {
    mockProcessedEvents.clear();
    jest.mocked(syncSubscriptionFromStripe)
        .mockReset()
        .mockResolvedValue({ outcome: 'synced', serviceId: SERVICE_ID, isPremiumActive: true });
    jest.mocked(sendMail).mockReset().mockResolvedValue({ ok: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('POST /api/stripe/webhook — podpis', () => {
    it('bez naglowka stripe-signature daje 400 i nie synchronizuje', async () => {
        const response = await deliver(SUBSCRIPTION_UPDATED);

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
        const signature = signer.webhooks.generateTestHeaderString({
            payload: SUBSCRIPTION_UPDATED,
            secret: WEBHOOK_SECRET,
        });

        const response = await deliver(SUBSCRIPTION_UPDATED.replace('sub_1', 'sub_2'), signature);

        expect(response.status).toBe(400);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });

    it('smieciowy naglowek daje 400', async () => {
        const response = await deliver(SUBSCRIPTION_UPDATED, 'garbage');

        expect(response.status).toBe(400);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });
});

describe('POST /api/stripe/webhook — routing zdarzen', () => {
    it('customer.subscription.updated synchronizuje subskrypcje ze zdarzenia', async () => {
        const response = await signed(SUBSCRIPTION_UPDATED);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: { received: true }, error: null });
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', {});
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('checkout.session.completed wiaze wpis z client_reference_id i powiadamia foundera', async () => {
        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', { serviceId: SERVICE_ID });
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(jest.mocked(sendMail).mock.calls[0]?.[0].text).toContain(SERVICE_ID);
    });

    it('checkout zakonczony konfliktem nie wysyla maila o zakupie (wysyla go synchronizacja)', async () => {
        jest.mocked(syncSubscriptionFromStripe).mockResolvedValue({
            outcome: 'conflict',
            serviceId: SERVICE_ID,
        });

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('invoice.payment_failed synchronizuje subskrypcje z faktury', async () => {
        const payload = event('evt_invoice', 'invoice.payment_failed', {
            id: 'in_1',
            object: 'invoice',
            parent: {
                type: 'subscription_details',
                subscription_details: { subscription: 'sub_9' },
            },
        });

        const response = await signed(payload);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_9', {});
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
        expect(mockProcessedEvents.has('evt_checkout')).toBe(false);
        expect(sendMail).not.toHaveBeenCalled();

        const retried = await signed(CHECKOUT_COMPLETED);

        expect(retried.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(2);
        expect(mockProcessedEvents.has('evt_checkout')).toBe(true);
    });

    it('zawieszony sendMail nie blokuje odpowiedzi ponad limit — handler zwraca 200', async () => {
        jest.useFakeTimers();
        jest.mocked(sendMail).mockReturnValue(new Promise(() => {}));

        const pending = signed(CHECKOUT_COMPLETED);
        await jest.advanceTimersByTimeAsync(NOTIFICATION_TIMEOUT_MS);
        const response = await pending;

        expect(response.status).toBe(200);
        expect(mockProcessedEvents.has('evt_checkout')).toBe(true);
        expect(console.error).toHaveBeenCalledWith('subscription notification not delivered', {
            kind: 'premium_purchased',
            result: 'timed_out',
        });
    });

    it('nieudana wysylka maila nie zmienia odpowiedzi (200)', async () => {
        jest.mocked(sendMail).mockResolvedValue({ ok: false, code: 'SEND_FAILED' });

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
    });
});
