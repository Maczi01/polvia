/**
 * Atrapy granic synchronizacji subskrypcji (`subscription-sync.ts`) dla testow: baza za
 * adapterem `@/lib/subscription-store` (slownik w pamieci per `serviceId`) i `stripe` z samym
 * `subscriptions.retrieve`. Obie to zewnetrzne serwisy — logika decyzji zostaje prawdziwa.
 *
 * Uzycie w tescie (fabryka `jest.mock` nie widzi importow, wiec bierze modul przez
 * `jest.requireActual`; rejestr modulow jest wspolny, wiec test i atrapa dziela stan):
 *
 *   jest.mock('@/lib/subscription-store', () =>
 *       jest.requireActual('<sciezka>/fake-subscription-store').fakeSubscriptionStoreModule);
 */
import type { StripeSubscriptionSnapshot } from '@/lib/subscription-sync';
import type {
    StoredSubscription,
    SubscriptionRecord,
    SubscriptionTransaction,
} from '@/lib/subscription-store';

export const SERVICE_A = '11111111-1111-4111-8111-111111111111';
export const SERVICE_B = '22222222-2222-4222-8222-222222222222';
export const DAY_MS = 24 * 60 * 60 * 1000;
export const PRICE_MONTHLY = 'price_monthly_test';
export const PRICE_YEARLY = 'price_yearly_test';

export const fakeSubscriptionDb = {
    services: new Set<string>(),
    slugs: new Map<string, string>(),
    subscriptions: new Map<string, SubscriptionRecord>(),
    promotions: new Map<string, Date>(),
};

/** Dwa wpisy (A ze slugiem `kancelaria-a`, B bez), bez subskrypcji i rankingu. */
export function resetFakeSubscriptionDb(): void {
    fakeSubscriptionDb.services = new Set([SERVICE_A, SERVICE_B]);
    fakeSubscriptionDb.slugs = new Map([['kancelaria-a', SERVICE_A]]);
    fakeSubscriptionDb.subscriptions = new Map();
    fakeSubscriptionDb.promotions = new Map();
}

const transactionStore: SubscriptionTransaction = {
    lockService: async serviceId => fakeSubscriptionDb.services.has(serviceId),
    findSubscription: async (serviceId): Promise<StoredSubscription | null> => {
        const row = fakeSubscriptionDb.subscriptions.get(serviceId);
        if (!row) return null;
        const { serviceId: _id, stripeCustomerId: _customer, ...stored } = row;
        return stored;
    },
    saveSubscription: async record => {
        fakeSubscriptionDb.subscriptions.set(record.serviceId, record);
    },
    // Kontrakt adaptera: zapis nie skraca dluzszego terminu, `null` usuwa wiersz.
    setPromotion: async (serviceId, expiresAt) => {
        if (expiresAt === null) {
            fakeSubscriptionDb.promotions.delete(serviceId);
            return;
        }
        const current = fakeSubscriptionDb.promotions.get(serviceId);
        const isLonger = current === undefined || expiresAt.getTime() > current.getTime();
        if (isLonger) fakeSubscriptionDb.promotions.set(serviceId, expiresAt);
    },
};

export const fakeSubscriptionStoreModule = {
    findServiceIdBySubscriptionId: async (id: string): Promise<string | null> =>
        [...fakeSubscriptionDb.subscriptions.values()].find(row => row.stripeSubscriptionId === id)
            ?.serviceId ?? null,
    findServiceIdBySlug: async (slug: string): Promise<string | null> =>
        fakeSubscriptionDb.slugs.get(slug) ?? null,
    runSubscriptionTransaction: <T>(
        work: (store: SubscriptionTransaction) => Promise<T>,
    ): Promise<T> => work(transactionStore),
};

export const fakeStripeRetrieve = jest.fn<Promise<StripeSubscriptionSnapshot>, [string]>();

export const fakeStripeModule = {
    stripe: { subscriptions: { retrieve: fakeStripeRetrieve } },
    STRIPE_LIVE_MODE: false,
};

/** Z dokladnoscia do sekundy (Stripe podaje sekundy uniksowe). */
export function wholeSeconds(ms: number): Date {
    return new Date(Math.floor(ms / 1000) * 1000);
}

/** Okres: zaczal sie 10 dni temu, konczy za 20 dni. */
export const PERIOD_START = wholeSeconds(Date.now() - 10 * DAY_MS);
export const PERIOD_END = wholeSeconds(Date.now() + 20 * DAY_MS);

function toUnix(date: Date): number {
    return Math.floor(date.getTime() / 1000);
}

export interface SnapshotOverrides {
    id?: string;
    status?: string;
    periodStart?: Date;
    periodEnd?: Date;
    priceId?: string;
    metadata?: Record<string, string>;
    /** Pozycje subskrypcji; domyslnie jedna z `periodStart`/`periodEnd`/`priceId`. */
    items?: Array<{ start: Date; end: Date; priceId?: string }>;
}

export function stripeSubscription(overrides: SnapshotOverrides = {}): StripeSubscriptionSnapshot {
    const items = overrides.items ?? [
        {
            start: overrides.periodStart ?? PERIOD_START,
            end: overrides.periodEnd ?? PERIOD_END,
            priceId: overrides.priceId,
        },
    ];
    return {
        id: overrides.id ?? 'sub_A',
        customer: 'cus_A',
        status: overrides.status ?? 'active',
        cancel_at_period_end: false,
        metadata: overrides.metadata ?? {},
        items: {
            data: items.map(item => ({
                current_period_start: toUnix(item.start),
                current_period_end: toUnix(item.end),
                price: { id: item.priceId ?? PRICE_MONTHLY },
            })),
        },
    };
}

export function stripeReturns(subscription: StripeSubscriptionSnapshot): void {
    fakeStripeRetrieve.mockResolvedValue(subscription);
}

export function storedActive(serviceId: string, stripeSubscriptionId: string): SubscriptionRecord {
    return {
        serviceId,
        stripeSubscriptionId,
        stripeCustomerId: 'cus_first',
        status: 'active',
        currentPeriodStart: PERIOD_START,
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
    };
}

/** Ranking, jaki synchronizacja nadaje do `paidUntil` (koniec oplaconego okresu + karencja). */
export function rankingUntil(paidUntil: Date, graceDays: number): Date {
    return new Date(paidUntil.getTime() + graceDays * DAY_MS);
}
