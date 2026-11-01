/**
 * @jest-environment node
 */
// Bramki trybu (klucz testowy + baza nielokalna, `livemode`) i ich kolejnosc wzgledem dedupe.
import { sendMail } from '@/lib/mailer';
import { syncSubscriptionFromStripe } from '@/lib/subscription-sync';

import {
    CHECKOUT_COMPLETED,
    event,
    keyMode,
    processedEvents,
    REMOTE_DATABASE_URL,
    resetWebhookKit,
    SERVICE_ID,
    signedRequest,
    SUBSCRIPTION_UPDATED,
    webhookEnv,
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

const LIVE_SUBSCRIPTION_UPDATED = event(
    'evt_live',
    'customer.subscription.updated',
    { id: 'sub_1', object: 'subscription' },
    true,
);

function signed(payload: string): Promise<Response> {
    return POST(signedRequest(payload));
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

describe('POST /api/stripe/webhook — tryb konta (livemode)', () => {
    it('zdarzenie live przy kluczu testowym: 200 bez synchronizacji i bez oznaczenia', async () => {
        const response = await signed(LIVE_SUBSCRIPTION_UPDATED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
        expect(processedEvents.has('evt_live')).toBe(false);
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
        webhookEnv.DATABASE_URL = REMOTE_DATABASE_URL;

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({
            data: null,
            error: { code: 'CONFIG_MISMATCH', message: expect.any(String) },
        });
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
        expect(processedEvents.has('evt_checkout')).toBe(false);
        expect(sendMail).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('non-local database'), {
            eventId: 'evt_checkout',
        });
        const logged = JSON.stringify(jest.mocked(console.error).mock.calls);
        expect(logged).not.toContain('db.prod.example.com');
        expect(logged).not.toContain('secret');
    });

    it('klucz testowy + baza lokalna: synchronizuje', async () => {
        const response = await signed(SUBSCRIPTION_UPDATED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', {});
    });

    it('klucz produkcyjny + baza produkcyjna: synchronizuje', async () => {
        keyMode.isLive = true;
        webhookEnv.DATABASE_URL = REMOTE_DATABASE_URL;
        const payload = event(
            'evt_live_updated',
            'customer.subscription.updated',
            { id: 'sub_1', object: 'subscription' },
            true,
        );

        const response = await signed(payload);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).toHaveBeenCalledWith('sub_1', {});
        expect(processedEvents.has('evt_live_updated')).toBe(true);
    });
});

describe('POST /api/stripe/webhook — kolejnosc bramek', () => {
    it('zdarzenie live + klucz testowy + baza produkcyjna: 503 z bramki bazy, nie 200 z bramki livemode', async () => {
        webhookEnv.DATABASE_URL = REMOTE_DATABASE_URL;

        const response = await signed(LIVE_SUBSCRIPTION_UPDATED);

        expect(response.status).toBe(503);
        expect((await response.json()).error.code).toBe('CONFIG_MISMATCH');
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
        expect(processedEvents.has('evt_live')).toBe(false);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it('zdarzenie juz w stripe_events + klucz testowy + baza produkcyjna: 503 przed dedupe', async () => {
        // Blad konfiguracji ma byc widoczny tez dla ponowien juz przetworzonych zdarzen.
        processedEvents.add('evt_checkout');
        webhookEnv.DATABASE_URL = REMOTE_DATABASE_URL;

        const response = await signed(CHECKOUT_COMPLETED);

        expect(response.status).toBe(503);
        expect((await response.json()).error.code).toBe('CONFIG_MISMATCH');
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
    });

    it('zdarzenie live juz w stripe_events przy kluczu testowym: bramka livemode przed dedupe (log)', async () => {
        processedEvents.add('evt_live');

        const response = await signed(LIVE_SUBSCRIPTION_UPDATED);

        expect(response.status).toBe(200);
        expect(syncSubscriptionFromStripe).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('livemode'), {
            eventId: 'evt_live',
            eventLivemode: true,
        });
    });

    it('niepodpisane zadanie przy blednej konfiguracji: 400 z podpisu, nie 503', async () => {
        webhookEnv.DATABASE_URL = REMOTE_DATABASE_URL;

        const response = await POST(signedRequest(CHECKOUT_COMPLETED, 'whsec_attacker'));

        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('INVALID_SIGNATURE');
        expect(console.error).not.toHaveBeenCalled();
    });
});
