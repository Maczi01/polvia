import { and, eq, gt, notExists, sql } from 'drizzle-orm';
import type {
    PgDatabase,
    PgDeleteBase,
    PgDeleteWithout,
    PgInsertBase,
    PgInsertWithout,
} from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

import { promotedServicesTable, serviceProfilesTable } from './schema';

/**
 * Zapis rankingu (`promoted_services`) wspolny dla premium recznego (`db:premium`, seed)
 * i subskrypcji Stripe (`subscription-store.ts`). Buildery dostaja klienta albo transakcje
 * z zewnatrz (nie importuja `./index`), wiec SQL da sie sprawdzic na `drizzle.mock()`.
 */

/** Klient albo transakcja. */
export type PromotionDatabase = PgDatabase<PostgresJsQueryResultHKT>;

type ExtendPromotionQuery = PgInsertWithout<
    PgInsertBase<typeof promotedServicesTable, PostgresJsQueryResultHKT>,
    false,
    'onConflictDoNothing' | 'onConflictDoUpdate'
>;

type RemovePromotionQuery = PgDeleteWithout<
    PgDeleteBase<typeof promotedServicesTable, PostgresJsQueryResultHKT>,
    false,
    'where'
>;

/**
 * Pozycja w rankingu co najmniej do `expiresAt`: istniejacemu wierszowi zmienia tylko
 * termin, tylko na pozniejszy (`GREATEST`), a `priority` zostawia operatorowi. Dzieki temu
 * odnowienie subskrypcji nie skraca recznego przedluzenia i odwrotnie.
 */
export function buildExtendPromotionQuery(
    db: PromotionDatabase,
    serviceId: string,
    expiresAt: Date,
): ExtendPromotionQuery {
    return db
        .insert(promotedServicesTable)
        .values({ serviceId, expiresAt })
        .onConflictDoUpdate({
            target: promotedServicesTable.serviceId,
            set: {
                expiresAt: sql`GREATEST(${promotedServicesTable.expiresAt}, excluded.expires_at)`,
            },
        });
}

/**
 * Zdjecie z rankingu po utracie premium z subskrypcji — CHYBA ZE wpis ma trwajace premium
 * reczne (`service_profiles.manual_premium_until > NOW()`): ranking ustawil wtedy seed /
 * `db:premium` (`buildExtendPromotionQuery`), wiec wiersz siega co najmniej konca tej daty.
 */
export function buildRemovePromotionQuery(
    db: PromotionDatabase,
    serviceId: string,
): RemovePromotionQuery {
    return db.delete(promotedServicesTable).where(
        and(
            eq(promotedServicesTable.serviceId, serviceId),
            notExists(
                db
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
}
