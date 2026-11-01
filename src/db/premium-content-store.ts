import { eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgInsertBase, PgInsertWithout } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase, PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

import { manualPremiumEnd, manualPremiumLastDay } from '../lib/manual-premium';
import type { PremiumContentData } from './premium-content-schema';
import {
    promotedServicesTable,
    serviceLocationsTable,
    serviceProfilesTable,
    servicesTable,
} from './schema';
import type { PremiumContentStore, ServiceRef } from './upsert-premium-content';

/**
 * Adapter Drizzle portu `PremiumContentStore`. Dostaje klienta z zewnatrz (nie importuje
 * `./index`), wiec zapytania da sie zbudowac na `drizzle.mock()` bez bazy.
 */

/** Klient albo transakcja — zapytania zapisu ida w jednej transakcji. */
type Database = PgDatabase<PostgresJsQueryResultHKT>;

type UpsertQuery<Table extends typeof serviceProfilesTable | typeof promotedServicesTable> =
    PgInsertWithout<
        PgInsertBase<Table, PostgresJsQueryResultHKT>,
        false,
        'onConflictDoNothing' | 'onConflictDoUpdate'
    >;

/** Wylaczny koniec premium recznego z bloku albo `null`, gdy blok nie ma `activeUntil`. */
export function manualPremiumUntilOf(content: PremiumContentData): Date | null {
    return content.activeUntil === undefined ? null : manualPremiumEnd(content.activeUntil);
}

/**
 * `insert … on conflict (service_id) do update` — jeden wiersz na usluge. Plik wpisu jest
 * zrodlem prawdy, wiec blok bez `activeUntil` zeruje `manual_premium_until`.
 */
export function buildSavePremiumContentQuery(
    db: Database,
    serviceId: string,
    content: PremiumContentData,
): UpsertQuery<typeof serviceProfilesTable> {
    const values = {
        template: content.template,
        coverImage: content.coverImage,
        gallery: content.gallery,
        priceList: content.priceList,
        faq: content.faq,
        manualPremiumUntil: manualPremiumUntilOf(content),
    };

    return db
        .insert(serviceProfilesTable)
        .values({ serviceId, ...values })
        .onConflictDoUpdate({
            target: serviceProfilesTable.serviceId,
            set: { ...values, updatedAt: sql`now()` },
        });
}

/**
 * Pozycja w rankingu co najmniej do `expiresAt` — ta sama regula co przy subskrypcji
 * (`subscription-store.ts`, `setPromotion`): istniejacemu wierszowi zmienia tylko termin,
 * tylko na pozniejszy (`GREATEST`), a `priority` zostawia operatorowi. Nigdy nie usuwa.
 */
export function buildExtendPromotionQuery(
    db: Database,
    serviceId: string,
    expiresAt: Date,
): UpsertQuery<typeof promotedServicesTable> {
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

/** Usluga bez slugu (przed backfillem) nie ma adresu profilu ani katalogu zdjec. */
export function withServiceSlug(
    rows: readonly { id: string; slug: string | null }[],
): ServiceRef[] {
    return rows.flatMap(({ id, slug }) => (slug === null ? [] : [{ id, slug }]));
}

export function createPremiumContentStore(db: PostgresJsDatabase): PremiumContentStore {
    return {
        async findServicesByLocationSlugs(locationSlugs) {
            const rows = await db
                .selectDistinct({ id: servicesTable.id, slug: servicesTable.slug })
                .from(serviceLocationsTable)
                .innerJoin(servicesTable, eq(servicesTable.id, serviceLocationsTable.serviceId))
                .where(inArray(serviceLocationsTable.slug, [...locationSlugs]));

            return withServiceSlug(rows);
        },

        async findContent(serviceId) {
            const [row] = await db
                .select({
                    template: serviceProfilesTable.template,
                    coverImage: serviceProfilesTable.coverImage,
                    gallery: serviceProfilesTable.gallery,
                    priceList: serviceProfilesTable.priceList,
                    faq: serviceProfilesTable.faq,
                    manualPremiumUntil: serviceProfilesTable.manualPremiumUntil,
                })
                .from(serviceProfilesTable)
                .where(eq(serviceProfilesTable.serviceId, serviceId))
                .limit(1);
            if (!row) return null;

            // Ksztalt bloku z pliku: data zamiast chwili, zeby diff porownal je wprost.
            const { manualPremiumUntil, ...content } = row;
            return manualPremiumUntil === null
                ? content
                : { ...content, activeUntil: manualPremiumLastDay(manualPremiumUntil) };
        },

        async saveContent(serviceId, content) {
            const manualPremiumUntil = manualPremiumUntilOf(content);
            // Tresc, data i ranking razem: premium bez pozycji w rankingu (albo odwrotnie)
            // po przerwanym zapisie bylby stanem, ktorego nie opisuje plik wpisu.
            await db.transaction(async tx => {
                await buildSavePremiumContentQuery(tx, serviceId, content);
                if (manualPremiumUntil !== null) {
                    await buildExtendPromotionQuery(tx, serviceId, manualPremiumUntil);
                }
            });
        },
    };
}
