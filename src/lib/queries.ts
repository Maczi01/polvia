import { db } from '@/db';
import {
    newsletterTable,
    promotedServicesTable,
    serviceEngagementsTable,
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    tagsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import { servicesTranslationsAlias } from '@/db/aliases';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import 'server-only';
import { Service } from '@/types';

export async function getServices(locale: string = 'en') {
    const results = await db
        .select({
            id: serviceLocationsTable.id,
            serviceId: servicesTable.id,

            name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`.as(
                'name',
            ),

            description: servicesTranslationsAlias.description,

            category: servicesTable.category,
            city: serviceLocationsTable.city,
            street: serviceLocationsTable.street,
            voivodeship: serviceLocationsTable.voivodeship,
            postcode: serviceLocationsTable.postcode,
            latitude: serviceLocationsTable.latitude,
            longitude: serviceLocationsTable.longitude,
            openingHours: serviceLocationsTable.openingHours,
            phoneNumber: serviceLocationsTable.phoneNumber,
            email: serviceLocationsTable.email,
            webpage: servicesTable.webpage,
            image: servicesTable.image,

            priority: sql<number>`COALESCE(${promotedServicesTable.priority}, 0)`.as('priority'),
            clicks: sql<number>`COALESCE(${serviceEngagementsTable.clicks}, 0)`.as('clicks'),

            tags: sql<string[]>`
              (
                SELECT array_agg(ttt.name)
                FROM ${servicesTagsTable} st
                JOIN ${tagsTable} t
                  ON t.id = st.tag_id
                JOIN ${tagsTranslationsTable} ttt
                  ON ttt.tag_id = t.id
                WHERE st.service_id = ${servicesTable.id}
                  AND ttt.language_code = ${locale}
              )
            `.as('tags'),
        })
        .from(servicesTable)

        .innerJoin(serviceLocationsTable, eq(servicesTable.id, serviceLocationsTable.serviceId))

        .leftJoin(
            servicesTranslationsAlias,
            and(
                eq(servicesTranslationsAlias.serviceId, servicesTable.id),
                eq(servicesTranslationsAlias.languageCode, locale),
            ),
        )

        .leftJoin(
            promotedServicesTable,
            and(
                eq(servicesTable.id, promotedServicesTable.serviceId),
                gt(promotedServicesTable.expiresAt, sql`NOW()`),
            ),
        )
        .leftJoin(serviceEngagementsTable, eq(servicesTable.id, serviceEngagementsTable.serviceId))

        .orderBy(
            desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        );

    return results as Service[];
}

export async function addEmailToNewsletter(email: string) {
    try {
        const result = await db.insert(newsletterTable)
            .values({ email })
            .onConflictDoNothing()
            .returning();

        if (result.length === 0) {
            return { success: false, message: 'Email already subscribed' };
        }

        return { success: true, message: 'Subscription successful' };
    } catch (error) {
        console.error('Database error:', error);
        return { success: false, message: 'Database error' };
    }
}

export async function getMostPopular(locale: string) {
    const results = await db
        .select({
            id: serviceLocationsTable.id,
            serviceId: servicesTable.id,

            name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`.as(
                'name',
            ),

            description: servicesTranslationsAlias.description,

            category: servicesTable.category,
            city: serviceLocationsTable.city,
            street: serviceLocationsTable.street,
            voivodeship: serviceLocationsTable.voivodeship,
            postcode: serviceLocationsTable.postcode,
            latitude: serviceLocationsTable.latitude,
            longitude: serviceLocationsTable.longitude,
            openingHours: serviceLocationsTable.openingHours,
            phoneNumber: serviceLocationsTable.phoneNumber,
            email: serviceLocationsTable.email,
            webpage: servicesTable.webpage,
            image: servicesTable.image,

            priority: sql<number>`COALESCE(${promotedServicesTable.priority}, 0)`.as('priority'),
            clicks: sql<number>`COALESCE(${serviceEngagementsTable.clicks}, 0)`.as('clicks'),

            tags: sql<string[]>`
              (
                SELECT array_agg(ttt.name)
                FROM ${servicesTagsTable} st
                JOIN ${tagsTable} t
                  ON t.id = st.tag_id
                JOIN ${tagsTranslationsTable} ttt
                  ON ttt.tag_id = t.id
                WHERE st.service_id = ${servicesTable.id}
                  AND ttt.language_code = ${locale}
              )
            `.as('tags'),
        })
        .from(servicesTable)

        .innerJoin(serviceLocationsTable, eq(servicesTable.id, serviceLocationsTable.serviceId))

        .leftJoin(
            servicesTranslationsAlias,
            and(
                eq(servicesTranslationsAlias.serviceId, servicesTable.id),
                eq(servicesTranslationsAlias.languageCode, locale),
            ),
        )

        .leftJoin(
            promotedServicesTable,
            and(
                eq(servicesTable.id, promotedServicesTable.serviceId),
                gt(promotedServicesTable.expiresAt, sql`NOW()`),
            ),
        )
        .leftJoin(serviceEngagementsTable, eq(servicesTable.id, serviceEngagementsTable.serviceId))

        .orderBy(
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        )
        .limit(5);

    return results as Service[];
}
