import 'server-only';

import type Stripe from 'stripe';
import { z } from 'zod';

import {
    isPremiumActive,
    premiumRankingExpiry,
    SUBSCRIPTION_STATUSES,
    type SubscriptionStatus,
} from '@/lib/premium';
import { isPremiumPriceId } from '@/lib/premium-prices';
import { stripe } from '@/lib/stripe';
import {
    findServiceIdBySlug,
    findServiceIdBySubscriptionId,
    runSubscriptionTransaction,
    type StoredSubscription,
    type SubscriptionRecord,
    type SubscriptionTransaction,
} from '@/lib/subscription-store';

/**
 * Pola subskrypcji Stripe, z ktorych liczymy stan. `Stripe.Subscription` jest do tego typu
 * przypisywalne; wezszy typ pozwala testom podac sam ksztalt bez rzutowania.
 *
 * API `2026-09-30.endive`: okres lezy na POZYCJACH (`items.data[].current_period_start|end`),
 * nie na subskrypcji.
 */
export type StripeSubscriptionSnapshot = Pick<
    Stripe.Subscription,
    'id' | 'status' | 'cancel_at_period_end' | 'metadata'
> & {
    customer: string | { id: string };
    items: {
        data: Array<
            Pick<Stripe.SubscriptionItem, 'current_period_start' | 'current_period_end'> & {
                price: { id: string };
            }
        >;
    };
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
 * - `synced`: stan w bazie odpowiada Stripe (zapisany albo — po stanie koncowym — juz aktualny),
 * - `conflict`: wpis ma inna aktywna subskrypcje — stan bez zmian. Synchronizacja NIE
 *   powiadamia (jest idempotentna i wolana przy kazdym zdarzeniu i resyncu); mail wysyla
 *   wolajacy raz, czyli webhook przy pierwszym dostarczeniu jednego typu zdarzenia,
 * - `unlinked`: subskrypcji nie da sie powiazac z wpisem (utworzona poza checkoutem albo
 *   z cena spoza allowlisty premium),
 * - `service_missing`: wskazanego wpisu nie ma w bazie.
 */
export type SubscriptionSyncResult =
    | { outcome: 'synced'; serviceId: string; isPremiumActive: boolean }
    | {
          outcome: 'conflict';
          serviceId: string;
          activeSubscriptionId: string;
          conflictingSubscriptionId: string;
          /** Druga subskrypcja jest oplacona (wymaga zwrotu); nieoplacona nie wymaga. */
          isIncomingActive: boolean;
      }
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

/**
 * Statusy, z ktorych subskrypcja Stripe nigdy nie wraca. Odczyt ze Stripe jest przed blokada
 * wiersza, wiec rownolegle zdarzenie moze przyniesc starszy stan — po stanie koncowym kazdy
 * inny stan TEJ SAMEJ subskrypcji jest z definicji nieswiezy.
 */
const TERMINAL_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
    'canceled',
    'incomplete_expired',
]);

function isSubscriptionStatus(status: string): status is SubscriptionStatus {
    return KNOWN_STATUSES.has(status);
}

function toSubscriptionRecord(
    serviceId: string,
    subscription: StripeSubscriptionSnapshot,
): SubscriptionRecord {
    const { id, status, customer } = subscription;
    if (!isSubscriptionStatus(status)) throw new SubscriptionSyncError('UNSUPPORTED_STATUS', id);

    const items = subscription.items.data;
    if (items.length === 0) throw new SubscriptionSyncError('MISSING_PERIOD', id);

    const periodStart = Math.max(...items.map(item => item.current_period_start));
    const periodEnd = Math.max(...items.map(item => item.current_period_end));

    return {
        serviceId,
        stripeSubscriptionId: id,
        stripeCustomerId: typeof customer === 'string' ? customer : customer.id,
        status,
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
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

/**
 * „Ratunkowy” zakup: zapisana jest INNA subskrypcja `past_due` (jeszcze w karencji), a przychodzi
 * oplacona (`active`/`trialing`) — np. po wygasnieciu karty founder kupil premium ponownie.
 * Nowa wygrywa; pozniejsze zdarzenia starej trafia na zapisana aktywna nowa i skoncza sie
 * konfliktem bez zapisu.
 */
function supersedesPastDue(
    stored: StoredSubscription | null,
    record: SubscriptionRecord,
    now: Date,
): boolean {
    if (!stored || stored.stripeSubscriptionId === record.stripeSubscriptionId) return false;

    return stored.status === 'past_due' && isPremiumActive(record, now);
}

/**
 * Inna subskrypcja wpisu, ktora wciaz daje premium, blokuje nadpisanie stanu — chyba ze to
 * `past_due` wypierana przez oplacona nowa (`supersedesPastDue`).
 */
function conflictingSubscriptionId(
    stored: StoredSubscription | null,
    record: SubscriptionRecord,
    now: Date,
): string | null {
    if (!stored || stored.stripeSubscriptionId === record.stripeSubscriptionId) return null;
    if (supersedesPastDue(stored, record, now)) return null;

    return isPremiumActive(stored, now) ? stored.stripeSubscriptionId : null;
}

/** Zapisany jest stan koncowy tej samej subskrypcji, a przychodzi stan sprzed niego. */
function isStaleAfterTerminal(
    stored: StoredSubscription | null,
    record: SubscriptionRecord,
): boolean {
    if (!stored || stored.stripeSubscriptionId !== record.stripeSubscriptionId) return false;

    return TERMINAL_STATUSES.has(stored.status) && !TERMINAL_STATUSES.has(record.status);
}

/** Decyzja i zapis pod blokada wiersza uslugi. */
async function applySubscriptionState(
    store: SubscriptionTransaction,
    record: SubscriptionRecord,
    now: Date,
): Promise<SubscriptionSyncResult> {
    const { serviceId, stripeSubscriptionId } = record;
    if (!(await store.lockService(serviceId))) return { outcome: 'service_missing', serviceId };

    const stored = await store.findSubscription(serviceId);
    const isIncomingActive = isPremiumActive(record, now);

    const activeSubscriptionId = conflictingSubscriptionId(stored, record, now);
    if (activeSubscriptionId) {
        return {
            outcome: 'conflict',
            serviceId,
            activeSubscriptionId,
            conflictingSubscriptionId: stripeSubscriptionId,
            isIncomingActive,
        };
    }

    if (isStaleAfterTerminal(stored, record)) {
        console.warn('subscription sync: stale state after terminal state ignored', {
            stripeSubscriptionId,
            incomingStatus: record.status,
        });
        return { outcome: 'synced', serviceId, isPremiumActive: false };
    }

    if (supersedesPastDue(stored, record, now)) {
        console.warn('subscription sync: paid subscription replaces past_due one', {
            serviceId,
            stripeSubscriptionId,
            replacedSubscriptionId: stored?.stripeSubscriptionId,
        });
    }

    await store.saveSubscription(record);
    await store.setPromotion(serviceId, isIncomingActive ? premiumRankingExpiry(record) : null);
    return { outcome: 'synced', serviceId, isPremiumActive: isIncomingActive };
}

/**
 * Odwzorowuje w bazie stan subskrypcji Stripe: `service_subscriptions` i pozycje
 * w `promoted_services`, w jednej transakcji z blokada wiersza uslugi (rownolegle zdarzenia
 * tego samego wpisu ida po kolei). Stan ze swiezo pobranej subskrypcji; stanu koncowego
 * (`canceled`) nie nadpisuje starszy odczyt z rownoleglego zdarzenia. Ponowienie jest
 * idempotentne. Bez skutkow ubocznych (maili) — te naleza do wolajacego.
 *
 * Rzuca przy bledzie Stripe/bazy i `SubscriptionSyncError` — webhook odpowiada wtedy 500
 * i Stripe ponawia.
 */
export async function syncSubscriptionFromStripe(
    stripeSubscriptionId: string,
    options: SyncOptions = {},
): Promise<SubscriptionSyncResult> {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Brak pozycji nie jest tu odrzucany — to blad `MISSING_PERIOD` nizej.
    const priceIds = subscription.items.data.map(item => item.price.id);
    if (!priceIds.every(priceId => isPremiumPriceId(priceId))) {
        console.warn('subscription sync: subscription without premium price ignored', {
            stripeSubscriptionId,
            priceIds,
        });
        return { outcome: 'unlinked' };
    }

    const serviceId = await resolveServiceId(subscription, options.serviceId);
    if (!serviceId) {
        console.warn('subscription sync: subscription not linked to a service', {
            stripeSubscriptionId,
        });
        return { outcome: 'unlinked' };
    }

    const record = toSubscriptionRecord(serviceId, subscription);
    const now = new Date();
    return runSubscriptionTransaction(store => applySubscriptionState(store, record, now));
}
