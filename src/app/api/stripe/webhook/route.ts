import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { stripe } from '@/lib/stripe';
import { isStripeEventProcessed, markStripeEventProcessed } from '@/lib/stripe-events';
import { subscriptionSyncTarget } from '@/lib/stripe-webhook-events';
import { notifyPremiumPurchased } from '@/lib/subscription-notifications';
import { syncSubscriptionFromStripe } from '@/lib/subscription-sync';

import { env } from '../../../../../env';

/**
 * Webhook Stripe: utrzymuje w bazie stan subskrypcji premium (`service_subscriptions`)
 * i pozycje w rankingu (`promoted_services`).
 *
 * Kolejnosc: 1) podpis (400), 2) dedupe `stripe_events` (duplikat → 200),
 * 3) synchronizacja (blad → 500, Stripe ponowi), 4) oznaczenie zdarzenia, 5) skutki uboczne
 * (mail do foundera) z limitem czasu i bledem tylko w logu.
 *
 * Celowo BEZ rate limitu (wyjatek od reguly „limit na kazdym publicznym endpoincie"):
 * jedyna bramka jest podpis HMAC Stripe sprawdzany przed jakimkolwiek I/O. Niepodpisane
 * zadanie konczy sie na tanim 400, a limit po IP odrzucalby ponowienia samego Stripe
 * (wspolne adresy wychodzace) i opoznial aktywacje premium.
 */
export const runtime = 'nodejs';

/**
 * Budzet: Stripe 2 × `STRIPE_TIMEOUT_MS` (z ponowieniem) + baza + `NOTIFICATION_TIMEOUT_MS`.
 * Ubicie funkcji przed oznaczeniem zdarzenia jest bezpieczne — Stripe ponowi, a synchronizacja
 * jest idempotentna.
 */
export const maxDuration = 30;

function jsonError(code: string, message: string, status: number): NextResponse {
    return NextResponse.json({ data: null, error: { code, message } }, { status });
}

function received(): NextResponse {
    return NextResponse.json({ data: { received: true }, error: null });
}

/** `null`: podpis niepoprawny albo przeterminowany. Inne bledy (konfiguracja) leca wyzej. */
function verifyEvent(payload: string, signature: string): Stripe.Event | null {
    try {
        return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        if (error instanceof Stripe.errors.StripeSignatureVerificationError) return null;
        throw error;
    }
}

async function processEvent(event: Stripe.Event): Promise<void> {
    if (await isStripeEventProcessed(event.id)) return;

    const target = subscriptionSyncTarget(event);
    if (!target) return;

    const { stripeSubscriptionId, ...options } = target;
    const result = await syncSubscriptionFromStripe(stripeSubscriptionId, options);
    const isFirstDelivery = await markStripeEventProcessed(event);

    if (
        isFirstDelivery &&
        event.type === 'checkout.session.completed' &&
        result.outcome === 'synced'
    ) {
        await notifyPremiumPurchased({ serviceId: result.serviceId, stripeSubscriptionId });
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return jsonError('MISSING_SIGNATURE', 'Missing Stripe signature', 400);

    try {
        // Surowa tresc: podpis liczony jest z bajtow, nie z przeparsowanego JSON-a.
        const event = verifyEvent(await request.text(), signature);
        if (!event) return jsonError('INVALID_SIGNATURE', 'Invalid Stripe signature', 400);

        await processEvent(event);
        return received();
    } catch (error) {
        // Szczegoly tylko w logu serwera — surowy blad Stripe/bazy nie wraca w odpowiedzi.
        console.error('Stripe webhook processing failed:', error);
        return jsonError('SYNC_FAILED', 'Webhook processing failed', 500);
    }
}
