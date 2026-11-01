/**
 * Wspolne atrapy i pomocniki testow webhooka Stripe (`src/app/api/stripe/webhook/route*.test.ts`).
 *
 * Granice zewnetrzne: `env`, tryb klucza Stripe, baza za `@/lib/stripe-event-dedupe`
 * (tabela `stripe_events` jako zbior w pamieci). Podpis liczy prawdziwa paczka `stripe`
 * (lokalne HMAC, bez sieci). Fabryka `jest.mock` nie widzi importow, wiec bierze moduly
 * stad przez `jest.requireActual` — rejestr modulow jest wspolny, wiec test i atrapy dziela stan.
 */
import Stripe from 'stripe';

export const WEBHOOK_SECRET = 'whsec_test_secret';
export const LOCAL_DATABASE_URL = 'postgres://user:secret@localhost:5433/mydb';
export const REMOTE_DATABASE_URL = 'postgres://user:secret@db.prod.example.com:5432/postgres';
export const SERVICE_ID = '11111111-1111-4111-8111-111111111111';

/** Domyslnie klucz testowy + baza lokalna (docker-compose); testy bramek je zmieniaja. */
export const webhookEnv = {
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    DATABASE_URL: LOCAL_DATABASE_URL,
};
export const keyMode = { isLive: false };
export const processedEvents = new Set<string>();

export const fakeEnvModule = {
    // Getter: modul czyta `env` dopiero w handlerze, a testy podmieniaja wartosci.
    get env(): typeof webhookEnv {
        return webhookEnv;
    },
};

export const fakeStripeModule = {
    stripe: new Stripe('sk_test_dummy'),
    get STRIPE_LIVE_MODE(): boolean {
        return keyMode.isLive;
    },
};

export const fakeDedupeModule = {
    isStripeEventProcessed: async (id: string): Promise<boolean> => processedEvents.has(id),
    markStripeEventProcessed: async ({ id }: { id: string }): Promise<boolean> => {
        if (processedEvents.has(id)) return false;
        processedEvents.add(id);
        return true;
    },
};

export function resetWebhookKit(): void {
    processedEvents.clear();
    webhookEnv.DATABASE_URL = LOCAL_DATABASE_URL;
    keyMode.isLive = false;
}

const signer = new Stripe('sk_test_dummy');

/** `livemode: false` — tryb klucza testowego z `keyMode`. */
export function event(
    id: string,
    type: string,
    object: Record<string, unknown>,
    livemode = false,
): string {
    return JSON.stringify({ id, object: 'event', type, livemode, data: { object } });
}

export function signatureFor(payload: string, secret = WEBHOOK_SECRET): string {
    return signer.webhooks.generateTestHeaderString({ payload, secret });
}

export function webhookRequest(payload: string, signature?: string): Request {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (signature !== undefined) headers.set('stripe-signature', signature);
    return new Request('https://www.polvia.pl/api/stripe/webhook', {
        method: 'POST',
        body: payload,
        headers,
    });
}

export function signedRequest(payload: string, secret = WEBHOOK_SECRET): Request {
    return webhookRequest(payload, signatureFor(payload, secret));
}

export function invoiceObject(stripeSubscriptionId: string): Record<string, unknown> {
    return {
        id: 'in_1',
        object: 'invoice',
        parent: {
            type: 'subscription_details',
            subscription_details: { subscription: stripeSubscriptionId },
        },
    };
}

export const SUBSCRIPTION_UPDATED = event('evt_sub_updated', 'customer.subscription.updated', {
    id: 'sub_1',
    object: 'subscription',
});

export const CHECKOUT_COMPLETED = event('evt_checkout', 'checkout.session.completed', {
    id: 'cs_1',
    object: 'checkout.session',
    mode: 'subscription',
    subscription: 'sub_1',
    client_reference_id: SERVICE_ID,
});

export const CONFLICT = {
    outcome: 'conflict',
    serviceId: SERVICE_ID,
    activeSubscriptionId: 'sub_first',
    conflictingSubscriptionId: 'sub_1',
    isIncomingActive: true,
} as const;
