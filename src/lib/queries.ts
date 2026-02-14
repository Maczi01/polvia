import { db } from '@/db';
import {
    newsletter,
    promotedServicesTable,
    serviceEngagementsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsAlias,
    tagsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import 'server-only';
import { Service } from '@/types';

export async function getServices(locale: string = 'en') {
    const results = await db
        .select({
            id: servicesTable.id,

            // Use COALESCE(...) if you have a fallback name in services
            name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`.as(
                'name',
            ),

            // If you have fallback for description:
            description: servicesTranslationsAlias.description,

            category: servicesTable.category,
            city: servicesTable.city,
            street: servicesTable.street,
            county: servicesTable.county,
            postcode: servicesTable.postcode,
            latitude: servicesTable.latitude,
            longitude: servicesTable.longitude,
            openingHours: servicesTable.openingHours,
            phoneNumber: servicesTable.phoneNumber,
            email: servicesTable.email,
            webpage: servicesTable.webpage,
            part: servicesTable.part,
            image: servicesTable.image,

            // Priority & clicks from your existing tables if needed
            priority: sql<number>`COALESCE(${promotedServicesTable.priority}, 0)`.as('priority'),
            clicks: sql<number>`COALESCE(${serviceEngagementsTable.clicks}, 0)`.as('clicks'),

            // ***** Subselect for tags array *****
            // We run a SELECT that joins the pivot + tags + tags_translations
            // filtering by the same service_id and the user’s locale.
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

        // Left-join for service translations (name/desc in chosen locale)
        .leftJoin(
            servicesTranslationsAlias,
            and(
                eq(servicesTranslationsAlias.serviceId, servicesTable.id),
                eq(servicesTranslationsAlias.languageCode, locale),
            ),
        )

        // Optional: Join for priority/clicks
        .leftJoin(
            promotedServicesTable,
            and(
                eq(servicesTable.id, promotedServicesTable.serviceId),
                gt(promotedServicesTable.expiresAt, sql`NOW()`),
            ),
        )
        .leftJoin(serviceEngagementsTable, eq(servicesTable.id, serviceEngagementsTable.serviceId))

        // Example ordering
        .orderBy(
            desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        );

    return results as Service[];
}

export async function addEmailToNewsletter(email: string) {
    try {
        const result = await db.insert(newsletter)
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
    // await db.insert(newsletter).values({
    //     email,
    //     createdAt: new Date(),
    //     updatedAt: new Date(),
    // }).onConflictDoNothing();
    // return { success: true, message: 'Email added to newsletter!' };
}

export async function getMostPopular(locale: string) {
    const results = await db
        .select({
            id: servicesTable.id,

            // Use COALESCE(...) if you have a fallback name in services
            name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`.as(
                'name',
            ),

            // If you have fallback for description:
            description: servicesTranslationsAlias.description,

            category: servicesTable.category,
            city: servicesTable.city,
            street: servicesTable.street,
            county: servicesTable.county,
            postcode: servicesTable.postcode,
            latitude: servicesTable.latitude,
            longitude: servicesTable.longitude,
            openingHours: servicesTable.openingHours,
            phoneNumber: servicesTable.phoneNumber,
            email: servicesTable.email,
            webpage: servicesTable.webpage,
            part: servicesTable.part,
            image: servicesTable.image,

            // Priority & clicks from your existing tables if needed
            priority: sql<number>`COALESCE(${promotedServicesTable.priority}, 0)`.as('priority'),
            clicks: sql<number>`COALESCE(${serviceEngagementsTable.clicks}, 0)`.as('clicks'),

            // ***** Subselect for tags array *****
            // We run a SELECT that joins the pivot + tags + tags_translations
            // filtering by the same service_id and the user’s locale.
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

        // Left-join for service translations (name/desc in chosen locale)
        .leftJoin(
            servicesTranslationsAlias,
            and(
                eq(servicesTranslationsAlias.serviceId, servicesTable.id),
                eq(servicesTranslationsAlias.languageCode, locale),
            ),
        )

        // Optional: Join for priority/clicks
        .leftJoin(
            promotedServicesTable,
            and(
                eq(servicesTable.id, promotedServicesTable.serviceId),
                gt(promotedServicesTable.expiresAt, sql`NOW()`),
            ),
        )
        .leftJoin(serviceEngagementsTable, eq(servicesTable.id, serviceEngagementsTable.serviceId))

        // Example ordering
        .orderBy(
            // desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        )
        .limit(5)
    ;

    return results as Service[];
}

