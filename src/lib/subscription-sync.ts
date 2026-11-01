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
import { SUBSCRIPTION_METADATA_KEYS } from '@/lib/subscription-metadata';
import {
    findServiceIdBySlug,
    findServiceIdBySubscriptionId,
    runSubscriptionTransaction,
    type SubscriptionRecord,
    type SubscriptionTransaction,
} from '@/lib/subscription-store';
import { decideSubscriptionWrite } from '@/lib/subscription-write-decision';

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
 * - `synced`: stan zapisany — baza odpowiada Stripe,
 * - `stale_ignored`: zapisany jest stan koncowy tej subskrypcji, a przyszedl starszy odczyt —
 *   baza bez zmian (juz aktualna),
 * - `conflict`: wpis ma inna subskrypcje z premium — stan bez zmian. Synchronizacja NIE
 *   powiadamia (jest idempotentna i wolana przy kazdym zdarzeniu i resyncu); mail wysyla
 *   wolajacy raz, czyli webhook przy pierwszym dostarczeniu jednego typu zdarzenia,
 * - `unlinked`: subskrypcji nie da sie powiazac z wpisem (utworzona poza checkoutem albo
 *   z cena spoza allowlisty premium),
 * - `service_missing`: wskazanego wpisu nie ma w bazie.
 */
export type SubscriptionSyncResult =
    | { outcome: 'synced'; serviceId: string; isPremiumActive: boolean }
    | { outcome: 'stale_ignored'; serviceId: string }
    | {
          outcome: 'conflict';
          serviceId: string;
          activeSubscriptionId: string;
          conflictingSubscriptionId: string;
          /**
           * Druga subskrypcja jest OPLACONA (`active`/`trialing`): podwojna oplata, wymaga
           * zwrotu. `past_due` w karencji ma premium, ale niczego nie zaplacila — `false`.
           */
          isIncomingActive: boolean;
      }
    | { outcome: 'unlinked' }
    | { outcome: 'service_missing'; serviceId: string };

export interface SyncOptions {
    /** Wpis wskazany przez zdarzenie (np. `client_reference_id` sesji checkoutu). */
    serviceId?: string;
}

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
 * na koncu `serviceId` z metadanych. Wskazanie, ktore nie jest UUID, nie przerywa lancucha:
 * metadane ustawia nasz checkout, wiec sa co najmniej tak wiarygodne.
 */
async function resolveServiceId(
    subscription: StripeSubscriptionSnapshot,
    hint: string | undefined,
): Promise<string | null> {
    if (hint !== undefined) {
        if (serviceIdSchema.safeParse(hint).success) return hint;
        console.warn('subscription sync: client_reference_id is not a service id, ignored', {
            stripeSubscriptionId: subscription.id,
        });
    }

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

type SubscriptionConflict = Extract<SubscriptionSyncResult, { outcome: 'conflict' }>;

/**
 * Oplacona druga subskrypcja wpisu = podwojna oplata. Log tutaj, nie w webhooku: mail wychodzi
 * tylko po checkoucie, a ten sam stan przychodzi tez z `subscription.*`, `invoice.*` i resyncu
 * CLI. Same identyfikatory, bez danych klienta.
 */
function logPaidConflict(conflict: SubscriptionConflict): void {
    if (!conflict.isIncomingActive) return;

    console.warn('subscription sync: second paid subscription for a service', {
        serviceId: conflict.serviceId,
        activeSubscriptionId: conflict.activeSubscriptionId,
        conflictingSubscriptionId: conflict.conflictingSubscriptionId,
    });
}

async function writeSubscriptionState(
    store: SubscriptionTransaction,
    record: SubscriptionRecord,
    replacedSubscriptionId: string | null,
    now: Date,
): Promise<SubscriptionSyncResult> {
    const { serviceId, stripeSubscriptionId } = record;
    if (replacedSubscriptionId) {
        console.warn('subscription sync: paid subscription replaces past_due one', {
            serviceId,
            stripeSubscriptionId,
            replacedSubscriptionId,
        });
    }

    const hasPremium = isPremiumActive(record, now);
    await store.saveSubscription(record);
    await store.setPromotion(serviceId, hasPremium ? premiumRankingExpiry(record) : null);
    return { outcome: 'synced', serviceId, isPremiumActive: hasPremium };
}

/** Wykonanie decyzji (`decideSubscriptionWrite`) pod blokada wiersza uslugi. */
async function applySubscriptionState(
    store: SubscriptionTransaction,
    record: SubscriptionRecord,
    now: Date,
): Promise<SubscriptionSyncResult> {
    const { serviceId, stripeSubscriptionId } = record;
    if (!(await store.lockService(serviceId))) {
        // Zaplacono, a nie ma czego zapisac — bez logu ta platnosc znika bez sladu.
        console.warn('subscription sync: service not found', { serviceId, stripeSubscriptionId });
        return { outcome: 'service_missing', serviceId };
    }

    const decision = decideSubscriptionWrite(await store.findSubscription(serviceId), record, now);
    switch (decision.kind) {
        case 'conflict': {
            const conflict: SubscriptionConflict = {
                outcome: 'conflict',
                serviceId,
                activeSubscriptionId: decision.activeSubscriptionId,
                conflictingSubscriptionId: stripeSubscriptionId,
                isIncomingActive: decision.isIncomingPaid,
            };
            logPaidConflict(conflict);
            return conflict;
        }
        case 'stale': {
            console.warn('subscription sync: stale state after terminal state ignored', {
                stripeSubscriptionId,
                incomingStatus: record.status,
            });
            return { outcome: 'stale_ignored', serviceId };
        }
        case 'write': {
            return writeSubscriptionState(store, record, decision.replacedSubscriptionId, now);
        }
    }
}

/**
 * Odwzorowuje w bazie stan podanej subskrypcji Stripe: `service_subscriptions` i pozycje
 * w `promoted_services`, w jednej transakcji z blokada wiersza uslugi (rownolegle zdarzenia
 * tego samego wpisu ida po kolei). Bez skutkow ubocznych (maili) — te naleza do wolajacego.
 *
 * Wolajacy daje obiekt swiezo pobrany ze Stripe: webhook przez `syncSubscriptionFromStripe`,
 * CLI wprost z `subscriptions.list` (bez drugiego `retrieve`).
 *
 * Allowlista cen: KAZDA pozycja musi miec cene premium. Pusta lista pozycji tu przechodzi
 * (`every` na pustej tablicy) i konczy sie bledem `MISSING_PERIOD` (webhook 500, Stripe
 * ponowi) — subskrypcja bez pozycji to stan nieoczekiwany, nie „cudza cena”. Inaczej niz
 * `hasOnlyPremiumPrices` (`premium-prices.ts`) przy weryfikacji sesji checkoutu: tam pusta
 * lista znaczy „nic nie kupiono” i daje odmowe bez bledu.
 *
 * Rzuca przy bledzie bazy i `SubscriptionSyncError`.
 */
export async function syncSubscriptionSnapshot(
    subscription: StripeSubscriptionSnapshot,
    options: SyncOptions = {},
): Promise<SubscriptionSyncResult> {
    const stripeSubscriptionId = subscription.id;
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

/**
 * Pobiera subskrypcje ze Stripe i synchronizuje ja (`syncSubscriptionSnapshot`). Stan zawsze
 * ze swiezego odczytu, wiec ponowienie jest idempotentne, a kolejnosc zdarzen dostarczanych
 * po kolei nie ma znaczenia. Wyscigi rownoleglych zdarzen opisuje `decideSubscriptionWrite`.
 *
 * Rzuca przy bledzie Stripe/bazy i `SubscriptionSyncError` — webhook odpowiada wtedy 500
 * i Stripe ponawia.
 */
export async function syncSubscriptionFromStripe(
    stripeSubscriptionId: string,
    options: SyncOptions = {},
): Promise<SubscriptionSyncResult> {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    return syncSubscriptionSnapshot(subscription, options);
}
