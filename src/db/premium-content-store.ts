import { eq, inArray, sql } from 'drizzle-orm';
import type { PgInsertBase, PgInsertWithout } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase, PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

import type { PremiumContentData } from './premium-content-schema';
import { serviceLocationsTable, serviceProfilesTable, servicesTable } from './schema';
import type { PremiumContentStore, ServiceRef } from './upsert-premium-content';

/**
 * Adapter Drizzle portu `PremiumContentStore`. Dostaje klienta z zewnatrz (nie importuje
 * `./index`), wiec zapytania da sie zbudowac na `drizzle.mock()` bez bazy.
 */

/** Upsert `service_profiles` po `onConflictDoUpdate` — do `await` albo `toSQL()`. */
type SavePremiumContentQuery = PgInsertWithout<
    PgInsertBase<typeof serviceProfilesTable, PostgresJsQueryResultHKT>,
    false,
    'onConflictDoNothing' | 'onConflictDoUpdate'
>;

/** `insert … on conflict (service_id) do update` — jeden wiersz na usluge. */
export function buildSavePremiumContentQuery(
    db: PostgresJsDatabase,
    serviceId: string,
    content: PremiumContentData,
): SavePremiumContentQuery {
    const values = {
        template: content.template,
        coverImage: content.coverImage,
        gallery: content.gallery,
        priceList: content.priceList,
        faq: content.faq,
    };

    return db
        .insert(serviceProfilesTable)
        .values({ serviceId, ...values })
        .onConflictDoUpdate({
            target: serviceProfilesTable.serviceId,
            set: { ...values, updatedAt: sql`now()` },
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
                })
                .from(serviceProfilesTable)
                .where(eq(serviceProfilesTable.serviceId, serviceId))
                .limit(1);

            return row ?? null;
        },

        async saveContent(serviceId, content) {
            await buildSavePremiumContentQuery(db, serviceId, content);
        },
    };
}
