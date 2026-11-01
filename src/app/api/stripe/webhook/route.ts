import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { isLocalDatabaseUrl } from '@/lib/database-host';
import { stripe, STRIPE_LIVE_MODE } from '@/lib/stripe';
import { isStripeEventProcessed, markStripeEventProcessed } from '@/lib/stripe-events';
import { subscriptionSyncTarget } from '@/lib/stripe-webhook-events';
import {
    notifyPremiumPurchased,
    notifySubscriptionConflict,
} from '@/lib/subscription-notifications';
import { type SubscriptionSyncResult, syncSubscriptionFromStripe } from '@/lib/subscription-sync';

import { env } from '../../../../../env';

/**
 * Webhook Stripe: utrzymuje w bazie stan subskrypcji premium (`service_subscriptions`)
 * i pozycje w rankingu (`promoted_services`).
 *
 * Kolejnosc: 1) podpis (400), 2) bramki trybu bez synchronizacji i bez oznaczenia: klucz
 * testowy + baza nielokalna → 503 (blad konfiguracji, Stripe ponowi), `livemode` zdarzenia
 * niezgodny z kluczem → 200, 3) dedupe `stripe_events` (duplikat → 200),
 * 4) synchronizacja (blad → 500, Stripe ponowi), 5) oznaczenie zdarzenia, 6) skutki uboczne
 * (maile do foundera) tylko przy pierwszym dostarczeniu, z limitem czasu i bledem tylko w logu.
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

/**
 * Maile wysylamy wylacznie po `checkout.session.completed`: zakup (i ewentualny konflikt)
 * zglaszamy raz na sesje, a nie przy kazdym `subscription.*`/`invoice.*` tej subskrypcji.
 * Sesja jest juz oplacona, wiec stan pobrany przy synchronizacji jest po platnosci.
 */
async function notifyAfterCheckout(
    result: SubscriptionSyncResult,
    stripeSubscriptionId: string,
): Promise<void> {
    if (result.outcome === 'synced') {
        // `synced` bywa stanem bez premium (np. pozny stan koncowy) — nie ma czego oglaszac.
        if (!result.isPremiumActive) return;
        await notifyPremiumPurchased({ serviceId: result.serviceId, stripeSubscriptionId });
        return;
    }
    // Nieoplacona druga subskrypcja nie wymaga zwrotu.
    if (result.outcome === 'conflict' && result.isIncomingActive) {
        await notifySubscriptionConflict({
            serviceId: result.serviceId,
            activeSubscriptionId: result.activeSubscriptionId,
            conflictingSubscriptionId: result.conflictingSubscriptionId,
        });
    }
}

async function processEvent(event: Stripe.Event): Promise<void> {
    if (await isStripeEventProcessed(event.id)) return;

    const target = subscriptionSyncTarget(event);
    if (!target) return;

    const { stripeSubscriptionId, ...options } = target;
    const result = await syncSubscriptionFromStripe(stripeSubscriptionId, options);
    const isFirstDelivery = await markStripeEventProcessed(event);

    if (isFirstDelivery && event.type === 'checkout.session.completed') {
        await notifyAfterCheckout(result, stripeSubscriptionId);
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    const signature = request.headers.get('stripe-signature');
    if (!signature) return jsonError('MISSING_SIGNATURE', 'Missing Stripe signature', 400);

    try {
        // Surowa tresc: podpis liczony jest z bajtow, nie z przeparsowanego JSON-a.
        const event = verifyEvent(await request.text(), signature);
        if (!event) return jsonError('INVALID_SIGNATURE', 'Invalid Stripe signature', 400);

        // Klucz testowy przy bazie nielokalnej (np. lokalny `.env` z produkcyjnym `DATABASE_URL`
        // + `stripe listen`): karta 4242 dalaby prawdziwemu wpisowi premium. 503, nie 200: przy
        // pomylce w zmiennych produkcji (klucz testowy + live `whsec`) Stripe ponawia zdarzenie
        // do 3 dni, wiec po poprawce klucza stan sam sie odtworzy. Bez adresu bazy w logu.
        if (!STRIPE_LIVE_MODE && !isLocalDatabaseUrl(env.DATABASE_URL)) {
            console.error('Stripe webhook: test key with non-local database, event rejected', {
                eventId: event.id,
            });
            return jsonError('CONFIG_MISMATCH', 'Webhook misconfigured', 503);
        }

        // Zdarzenie z drugiego trybu konta nie dotyka bazy. W praktyce lapie je juz podpis
        // (kazdy tryb ma wlasny `whsec`); zostaje jako tania druga linia obrony.
        // 200, zeby Stripe nie ponawial; bez oznaczenia w `stripe_events`.
        if (event.livemode !== STRIPE_LIVE_MODE) {
            console.warn('Stripe webhook: event livemode does not match API key mode, ignored', {
                eventId: event.id,
                eventLivemode: event.livemode,
            });
            return received();
        }

        await processEvent(event);
        return received();
    } catch (error) {
        // Szczegoly tylko w logu serwera — surowy blad Stripe/bazy nie wraca w odpowiedzi.
        console.error('Stripe webhook processing failed:', error);
        return jsonError('SYNC_FAILED', 'Webhook processing failed', 500);
    }
}
