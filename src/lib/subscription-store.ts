import 'server-only';

import { and, eq, gt, notExists, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
    promotedServicesTable,
    serviceProfilesTable,
    servicesTable,
    serviceSubscriptionsTable,
} from '@/db/schema';
import type { PremiumSubscriptionState } from '@/lib/premium';
import { subscriptionColumns } from '@/lib/subscription-query-parts';

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
    /**
     * `expiresAt` = pozycja w rankingu co najmniej do tej chwili; `null` = zdjecie z rankingu.
     *
     * Wiersz `promoted_services` nie mowi, kto go zalozyl (subskrypcja czy operator recznie),
     * a rozroznienie wymagaloby zmiany schematu. Dlatego:
     * - zapis NIE skraca dluzszego `expiresAt` (reczne przedluzenie operatora przetrwa
     *   odnowienie); koszt: skrocenie okresu subskrypcji przy aktywnym statusie (np. zmiana
     *   planu rocznego na miesieczny) nie skraca rankingu — premium liczy `isPremiumActive`
     *   z subskrypcji, nie z tej tabeli, a utrata uprawnien i tak konczy sie `null`,
     * - `null` usuwa wiersz, CHYBA ZE wpis ma trwajace premium reczne
     *   (`service_profiles.manual_premium_until > NOW()`). Inna reczna promocja (sam wiersz
     *   `promoted_services` bez daty w pliku) znika — operator zaklada ja ponownie.
     */
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
                    ...subscriptionColumns,
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
                // Trwajace premium reczne (przelew) trzyma ranking — ustawil go seed /
                // `db:premium` z `GREATEST`, wiec wiersz siega co najmniej konca tej daty.
                await tx.delete(promotedServicesTable).where(
                    and(
                        eq(promotedServicesTable.serviceId, serviceId),
                        notExists(
                            tx
                                .select({ serviceId: serviceProfilesTable.serviceId })
                                .from(serviceProfilesTable)
                                .where(
                                    and(
                                        eq(serviceProfilesTable.serviceId, serviceId),
                                        gt(serviceProfilesTable.manualPremiumUntil, sql`NOW()`),
                                    ),
                                ),
                        ),
                    ),
                );
                return;
            }

            // Przy istniejacym wpisie zmieniamy tylko termin — `priority` ustawia operator —
            // i tylko na pozniejszy (`GREATEST`), patrz JSDoc `setPromotion`.
            await tx
                .insert(promotedServicesTable)
                .values({ serviceId, expiresAt })
                .onConflictDoUpdate({
                    target: promotedServicesTable.serviceId,
                    set: {
                        expiresAt: sql`GREATEST(${promotedServicesTable.expiresAt}, excluded.expires_at)`,
                    },
                });
        },
    };
}

/**
 * Limity czekania w transakcji synchronizacji. Bez nich `FOR UPDATE` czeka na blokade
 * bez konca, a webhook ma `maxDuration` 30 s, z czego Stripe moze zajac 2 × 8 s — ubita
 * funkcja nie zostawia logu. Przekroczenie = blad bazy → webhook 500, Stripe ponowi.
 */
const LOCK_TIMEOUT = '5s';
const STATEMENT_TIMEOUT = '5s';

/**
 * Jedna transakcja: limity czekania, blokada uslugi, odczyt stanu, zapis subskrypcji
 * i rankingu. `set_config(..., true)` = `SET LOCAL`: limit znika z koncem transakcji,
 * wiec nie przecieka na inne zapytania wspoldzielonego polaczenia (pooler w trybie
 * transakcyjnym). Jedno zapytanie zamiast dwoch `SET LOCAL`.
 */
export function runSubscriptionTransaction<T>(
    work: (store: SubscriptionTransaction) => Promise<T>,
): Promise<T> {
    return db.transaction(async tx => {
        await tx.execute(
            sql`SELECT set_config('lock_timeout', ${LOCK_TIMEOUT}, true), set_config('statement_timeout', ${STATEMENT_TIMEOUT}, true)`,
        );
        return work(createTransactionStore(tx));
    });
}
