import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { promotedServicesTable, servicesTable, serviceSubscriptionsTable } from '@/db/schema';
import type { PremiumSubscriptionState } from '@/lib/premium';

/**
 * Adapter Drizzle dla `syncSubscriptionFromStripe`: wszystko, co synchronizacja czyta
 * i zapisuje w bazie. Logika decyzji (konflikt, ranking) zostaje w `subscription-sync.ts`.
 */

export type StoredSubscription = PremiumSubscriptionState & { stripeSubscriptionId: string };

export type SubscriptionRecord = StoredSubscription & {
    serviceId: string;
    stripeCustomerId: string;
};

export interface SubscriptionTransaction {
    /** Blokuje wiersz uslugi (`FOR UPDATE`) do konca transakcji; `false`, gdy uslugi nie ma. */
    lockService(serviceId: string): Promise<boolean>;
    findSubscription(serviceId: string): Promise<StoredSubscription | null>;
    saveSubscription(record: SubscriptionRecord): Promise<void>;
    /** `expiresAt` = pozycja w rankingu do tej chwili; `null` = zdjecie z rankingu. */
    setPromotion(serviceId: string, expiresAt: Date | null): Promise<void>;
}

export async function findServiceIdBySubscriptionId(
    stripeSubscriptionId: string,
): Promise<string | null> {
    const [row] = await db
        .select({ serviceId: serviceSubscriptionsTable.serviceId })
        .from(serviceSubscriptionsTable)
        .where(eq(serviceSubscriptionsTable.stripeSubscriptionId, stripeSubscriptionId))
        .limit(1);

    return row?.serviceId ?? null;
}

/** Bez filtra statusu: oplacony wpis wiazemy z subskrypcja nawet, gdy chwilowo nieaktywny. */
export async function findServiceIdBySlug(slug: string): Promise<string | null> {
    const [row] = await db
        .select({ id: servicesTable.id })
        .from(servicesTable)
        .where(eq(servicesTable.slug, slug))
        .limit(1);

    return row?.id ?? null;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function createTransactionStore(tx: Transaction): SubscriptionTransaction {
    return {
        async lockService(serviceId) {
            const rows = await tx
                .select({ id: servicesTable.id })
                .from(servicesTable)
                .where(eq(servicesTable.id, serviceId))
                .for('update');
            return rows.length > 0;
        },

        async findSubscription(serviceId) {
            const [row] = await tx
                .select({
                    stripeSubscriptionId: serviceSubscriptionsTable.stripeSubscriptionId,
                    status: serviceSubscriptionsTable.status,
                    currentPeriodStart: serviceSubscriptionsTable.currentPeriodStart,
                    currentPeriodEnd: serviceSubscriptionsTable.currentPeriodEnd,
                    cancelAtPeriodEnd: serviceSubscriptionsTable.cancelAtPeriodEnd,
                })
                .from(serviceSubscriptionsTable)
                .where(eq(serviceSubscriptionsTable.serviceId, serviceId))
                .limit(1);
            return row ?? null;
        },

        async saveSubscription({ serviceId, ...fields }) {
            await tx
                .insert(serviceSubscriptionsTable)
                .values({ serviceId, ...fields })
                .onConflictDoUpdate({
                    target: serviceSubscriptionsTable.serviceId,
                    set: { ...fields, updatedAt: new Date() },
                });
        },

        async setPromotion(serviceId, expiresAt) {
            if (expiresAt === null) {
                await tx
                    .delete(promotedServicesTable)
                    .where(eq(promotedServicesTable.serviceId, serviceId));
                return;
            }

            // Przy istniejacym wpisie zmieniamy tylko termin — `priority` ustawia operator.
            await tx
                .insert(promotedServicesTable)
                .values({ serviceId, expiresAt })
                .onConflictDoUpdate({
                    target: promotedServicesTable.serviceId,
                    set: { expiresAt },
                });
        },
    };
}

/** Jedna transakcja: blokada uslugi, odczyt stanu, zapis subskrypcji i rankingu. */
export function runSubscriptionTransaction<T>(
    work: (store: SubscriptionTransaction) => Promise<T>,
): Promise<T> {
    return db.transaction(tx => work(createTransactionStore(tx)));
}
