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

const LOCAL_DATABASE_URL = 'postgres://user:secret@localhost:5433/mydb';
const REMOTE_DATABASE_URL = 'postgres://user:secret@db.prod.example.com:5432/postgres';

/** Domyslnie klucz testowy + baza lokalna (docker-compose); testy bramki trybu je zmieniaja. */
const mockEnv = { STRIPE_WEBHOOK_SECRET: 'whsec_test_secret', DATABASE_URL: LOCAL_DATABASE_URL };
const mockKeyMode = { isLive: false };

// Getter: `jest.mock` jest wynoszony nad deklaracje `mockEnv`, a modul czyta `env` dopiero w handlerze.
jest.mock('../../../../../env', () => ({
    get env() {
        return mockEnv;
    },
}));
// Prawdziwa weryfikacja podpisu z paczki `stripe` (lokalne HMAC, bez sieci).
jest.mock('@/lib/stripe', () => {
    // Build CJS paczki eksportuje konstruktor jako `module.exports` (bez `default`).
    const StripeClient = jest.requireActual<typeof Stripe>('stripe');
    return {
        stripe: new StripeClient('sk_test_dummy'),
        get STRIPE_LIVE_MODE() {
            return mockKeyMode.isLive;
        },
    };
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

/** `livemode: false` — tryb klucza testowego z mocka `@/lib/stripe`. */
function event(
    id: string,
    type: string,
    object: Record<string, unknown>,
    livemode = false,
): string {
    return JSON.stringify({ id, object: 'event', type, livemode, data: { object } });
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

const CONFLICT = {
    outcome: 'conflict',
    serviceId: SERVICE_ID,
    activeSubscriptionId: 'sub_first',
    conflictingSubscriptionId: 'sub_1',
    isIncomingActive: true,
} as const;

beforeEach(() => {
    mockProcessedEvents.clear();
    mockEnv.DATABASE_URL = LOCAL_DATABASE_URL;
    mockKeyMode.isLive = false;
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

    it('checkout zakonczony konfliktem nie wysyla maila o zakupie', async () => {
        jest.mocked(syncSubscriptionFromStripe).mockResolvedValue(CONFLICT);

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        const subjects = jest.mocked(sendMail).mock.calls.map(([message]) => message.subject);
        expect(subjects).not.toContain('Nowa subskrypcja premium');
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

describe('POST /api/stripe/webhook — tryb konta (livemode)', () => {
    it('zdarzenie live przy kluczu testowym: 200 bez synchronizacji i bez oznaczenia', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const payload = event(
            'evt_live',
            'customer.subscription.updated',
            { id: 'sub_1', object: 'subscription' },
            true,
        );

        const response = await signed(payload);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
        expect(mockProcessedEvents.has('evt_live')).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('livemode'), {
            eventId: 'evt_live',
            eventLivemode: true,
        });
    });

    it('zdarzenie w trybie klucza jest synchronizowane', async () => {
        const response = await signed(SUBSCRIPTION_UPDATED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(1);
    });
});

describe('POST /api/stripe/webhook — klucz testowy a baza nielokalna', () => {
    it('klucz testowy + baza produkcyjna: 503 bez synchronizacji, bez oznaczenia i bez adresu bazy w logu', async () => {
        mockEnv.DATABASE_URL = REMOTE_DATABASE_URL;

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({
            data: null,
            error: { code: 'CONFIG_MISMATCH', message: expect.any(String) },
        });
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
        expect(mockProcessedEvents.has('evt_checkout')).toBe(false);
        expect(sendMail).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('non-local database'), {
            eventId: 'evt_checkout',
        });
        const logged = JSON.stringify(jest.mocked(console.error).mock.calls);
        expect(logged).not.toContain('db.prod.example.com');
        expect(logged).not.toContain('secret');
    });

    it('zdarzenie live + klucz testowy + baza produkcyjna: 503 z bramki bazy, nie 200 z bramki livemode', async () => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockEnv.DATABASE_URL = REMOTE_DATABASE_URL;
        const payload = event(
            'evt_live_remote',
            'customer.subscription.updated',
            { id: 'sub_1', object: 'subscription' },
            true,
        );

        const response = await signed(payload);

        expect(response.status).toBe(503);
        expect((await response.json()).error.code).toBe('CONFIG_MISMATCH');
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
        expect(mockProcessedEvents.has('evt_live_remote')).toBe(false);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('klucz testowy + baza lokalna: synchronizuje', async () => {
        const response = await signed(SUBSCRIPTION_UPDATED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', {});
    });

    it('klucz produkcyjny + baza produkcyjna: synchronizuje', async () => {
        mockKeyMode.isLive = true;
        mockEnv.DATABASE_URL = REMOTE_DATABASE_URL;
        const payload = event(
            'evt_live_updated',
            'customer.subscription.updated',
            { id: 'sub_1', object: 'subscription' },
            true,
        );

        const response = await signed(payload);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', {});
        expect(mockProcessedEvents.has('evt_live_updated')).toBe(true);
    });
});

describe('POST /api/stripe/webhook — mail o zakupie', () => {
    it('synced bez aktywnego premium nie wysyla maila o zakupie', async () => {
        jest.mocked(syncSubscriptionFromStripe).mockResolvedValue({
            outcome: 'synced',
            serviceId: SERVICE_ID,
            isPremiumActive: false,
        });

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(1);
        expect(mockProcessedEvents.has('evt_checkout')).toBe(true);
        expect(sendMail).not.toHaveBeenCalled();
    });
});

describe('POST /api/stripe/webhook — mail o konflikcie subskrypcji', () => {
    beforeEach(() => {
        jest.mocked(syncSubscriptionFromStripe).mockResolvedValue(CONFLICT);
    });

    it('pierwsze checkout.session.completed z konfliktem: dokladnie jeden mail o konflikcie', async () => {
        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(sendMail).toHaveBeenCalledTimes(1);
        const [message] = jest.mocked(sendMail).mock.calls[0] ?? [];
        expect(message?.to).toBe('founder@polvia.pl');
        expect(message?.text).toContain('sub_first');
        expect(message?.text).toContain('sub_1');
    });

    it('duplikat tego samego zdarzenia nie wysyla drugiego maila', async () => {
        await signed(CHECKOUT_COMPLETED);
        await signed(CHECKOUT_COMPLETED);

        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('rownolegle dostarczenie, ktore przegralo oznaczenie, nie wysyla maila', async () => {
        // Inne dostarczenie oznaczylo zdarzenie miedzy sprawdzeniem a zapisem.
        jest.mocked(syncSubscriptionFromStripe).mockImplementation(async () => {
            mockProcessedEvents.add('evt_checkout');
            return CONFLICT;
        });

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(200);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it.each([
        ['customer.subscription.updated', { id: 'sub_1', object: 'subscription' }],
        ['customer.subscription.created', { id: 'sub_1', object: 'subscription' }],
        [
            'invoice.paid',
            {
                id: 'in_1',
                object: 'invoice',
                parent: {
                    type: 'subscription_details',
                    subscription_details: { subscription: 'sub_1' },
                },
            },
        ],
    ])('%s z konfliktem nie wysyla maila', async (type, object) => {
        const response = await signed(event(`evt_${type}`, type, object));

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledTimes(1);
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('konflikt z nieoplacona druga subskrypcja nie wysyla maila', async () => {
        jest.mocked(syncSubscriptionFromStripe).mockResolvedValue({
            ...CONFLICT,
            isIncomingActive: false,
        });

        await signed(CHECKOUT_COMPLETED);

        expect(sendMail).not.toHaveBeenCalled();
    });
});
