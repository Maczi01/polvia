import 'server-only';

import type Stripe from 'stripe';
import { z } from 'zod';

import {
    isPremiumActive,
    premiumRankingExpiry,
    SUBSCRIPTION_STATUSES,
    type SubscriptionStatus,
} from '@/lib/premium';
import { stripe } from '@/lib/stripe';
import { notifySubscriptionConflict } from '@/lib/subscription-notifications';
import {
    findServiceIdBySlug,
    findServiceIdBySubscriptionId,
    runSubscriptionTransaction,
    type StoredSubscription,
    type SubscriptionRecord,
} from '@/lib/subscription-store';

/**
 * Pola subskrypcji Stripe, z ktorych liczymy stan. `Stripe.Subscription` jest do tego typu
 * przypisywalne; wezszy typ pozwala testom podac sam ksztalt bez rzutowania.
 *
 * API `2026-09-30.endive`: koniec okresu lezy na POZYCJACH (`items.data[].current_period_end`),
 * nie na subskrypcji.
 */
export type StripeSubscriptionSnapshot = Pick<
    Stripe.Subscription,
    'id' | 'status' | 'cancel_at_period_end' | 'metadata'
> & {
    customer: string | { id: string };
    items: { data: Array<Pick<Stripe.SubscriptionItem, 'current_period_end'>> };
};

export type SubscriptionSyncErrorCode = 'UNSUPPORTED_STATUS' | 'MISSING_PERIOD';

export class SubscriptionSyncError extends Error {
    constructor(
        readonly code: SubscriptionSyncErrorCode,
        readonly stripeSubscriptionId: string,
    ) {
        super(`${code}: ${stripeSubscriptionId}`);
        this.name = 'SubscriptionSyncError';
    }
}

/**
 * - `synced`: stan zapisany, ranking zaktualizowany,
 * - `conflict`: wpis ma inna aktywna subskrypcje — stan bez zmian (founder powiadomiony,
 *   jesli druga subskrypcja jest oplacona),
 * - `unlinked`: subskrypcji nie da sie powiazac z zadnym wpisem (np. utworzona poza checkoutem),
 * - `service_missing`: wskazanego wpisu nie ma w bazie.
 */
export type SubscriptionSyncResult =
    | { outcome: 'synced'; serviceId: string; isPremiumActive: boolean }
    | { outcome: 'conflict'; serviceId: string }
    | { outcome: 'unlinked' }
    | { outcome: 'service_missing'; serviceId: string };

export interface SyncOptions {
    /** Wpis wskazany przez zdarzenie (np. `client_reference_id` sesji checkoutu). */
    serviceId?: string;
}

/** Klucze `subscription.metadata`, ktore ustawia checkout (U9). Slug przezywa `db:reset`. */
export const SUBSCRIPTION_METADATA_KEYS = {
    serviceId: 'serviceId',
    serviceSlug: 'serviceSlug',
} as const;

const serviceIdSchema = z.string().uuid();

const KNOWN_STATUSES: ReadonlySet<string> = new Set(SUBSCRIPTION_STATUSES);

function isSubscriptionStatus(status: string): status is SubscriptionStatus {
    return KNOWN_STATUSES.has(status);
}

function toSubscriptionRecord(
    serviceId: string,
    subscription: StripeSubscriptionSnapshot,
): SubscriptionRecord {
    const { id, status, customer } = subscription;
    if (!isSubscriptionStatus(status)) throw new SubscriptionSyncError('UNSUPPORTED_STATUS', id);

    const periodEnds = subscription.items.data.map(item => item.current_period_end);
    if (periodEnds.length === 0) throw new SubscriptionSyncError('MISSING_PERIOD', id);

    return {
        serviceId,
        stripeSubscriptionId: id,
        stripeCustomerId: typeof customer === 'string' ? customer : customer.id,
        status,
        currentPeriodEnd: new Date(Math.max(...periodEnds) * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
}

/**
 * Wpis subskrypcji, w kolejnosci zaufania: wskazanie ze zdarzenia, istniejace powiazanie
 * w bazie, slug z metadanych (stabilny po `db:reset`, ktory nadaje uslugom nowe `id`),
 * na koncu `serviceId` z metadanych.
 */
async function resolveServiceId(
    subscription: StripeSubscriptionSnapshot,
    hint: string | undefined,
): Promise<string | null> {
    if (hint !== undefined) return serviceIdSchema.safeParse(hint).success ? hint : null;

    const linked = await findServiceIdBySubscriptionId(subscription.id);
    if (linked) return linked;

    const slug = subscription.metadata[SUBSCRIPTION_METADATA_KEYS.serviceSlug];
    const bySlug = slug ? await findServiceIdBySlug(slug) : null;
    if (bySlug) return bySlug;

    const metadataId = serviceIdSchema.safeParse(
        subscription.metadata[SUBSCRIPTION_METADATA_KEYS.serviceId],
    );
    return metadataId.success ? metadataId.data : null;
}

/** Inna subskrypcja wpisu, ktora wciaz daje premium, blokuje nadpisanie stanu. */
function conflictingSubscriptionId(
    stored: StoredSubscription | null,
    incomingId: string,
    now: Date,
): string | null {
    if (!stored || stored.stripeSubscriptionId === incomingId) return null;

    return isPremiumActive(stored, now) ? stored.stripeSubscriptionId : null;
}

type TransactionOutcome =
    | { kind: 'done'; result: SubscriptionSyncResult }
    | { kind: 'conflict'; activeSubscriptionId: string };

/**
 * Odwzorowuje w bazie stan subskrypcji Stripe: `service_subscriptions` i pozycje
 * w `promoted_services`, w jednej transakcji z blokada wiersza uslugi (rownolegle zdarzenia
 * tego samego wpisu ida po kolei). Stan zawsze ze swiezo pobranej subskrypcji, wiec
 * kolejnosc zdarzen nie ma znaczenia, a ponowienie jest idempotentne.
 *
 * Rzuca przy bledzie Stripe/bazy i `SubscriptionSyncError` — webhook odpowiada wtedy 500
 * i Stripe ponawia.
 */
export async function syncSubscriptionFromStripe(
    stripeSubscriptionId: string,
    options: SyncOptions = {},
): Promise<SubscriptionSyncResult> {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const serviceId = await resolveServiceId(subscription, options.serviceId);

    if (!serviceId) {
        console.warn('subscription sync: subscription not linked to a service', {
            stripeSubscriptionId,
        });
        return { outcome: 'unlinked' };
    }

    const record = toSubscriptionRecord(serviceId, subscription);
    const now = new Date();
    const isActive = isPremiumActive(record, now);

    const outcome = await runSubscriptionTransaction(async (store): Promise<TransactionOutcome> => {
        if (!(await store.lockService(serviceId))) {
            return { kind: 'done', result: { outcome: 'service_missing', serviceId } };
        }

        const stored = await store.findSubscription(serviceId);
        const activeSubscriptionId = conflictingSubscriptionId(
            stored,
            record.stripeSubscriptionId,
            now,
        );
        if (activeSubscriptionId) return { kind: 'conflict', activeSubscriptionId };

        await store.saveSubscription(record);
        await store.setPromotion(serviceId, isActive ? premiumRankingExpiry(record) : null);
        return {
            kind: 'done',
            result: { outcome: 'synced', serviceId, isPremiumActive: isActive },
        };
    });

    if (outcome.kind === 'done') return outcome.result;

    // Powiadomienie po zamknieciu transakcji — mail nie trzyma blokady wiersza. Tylko gdy
    // druga subskrypcja jest oplacona: anulowana/nieudana nie wymaga zwrotu.
    if (isActive) {
        await notifySubscriptionConflict({
            serviceId,
            activeSubscriptionId: outcome.activeSubscriptionId,
            conflictingSubscriptionId: record.stripeSubscriptionId,
        });
    }
    return { outcome: 'conflict', serviceId };
}
