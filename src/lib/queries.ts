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
import { isNotNull } from 'drizzle-orm';
import 'server-only';
import { type FeaturedService, pickFeaturedServices } from '@/lib/featured-services';
import { isPublicService } from '@/lib/public-service-filter';
import { Service } from '@/types';

export async function getServices(locale: string = 'en') {
    const results = await db
        .select({
            id: serviceLocationsTable.id,
            serviceId: servicesTable.id,
            slug: serviceLocationsTable.slug,

            name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`.as(
                'name',
            ),

            description: servicesTranslationsAlias.description,

            category: servicesTable.category,
            coverage: servicesTable.coverage,
            city: serviceLocationsTable.city,
            street: serviceLocationsTable.street,
            voivodeship: serviceLocationsTable.voivodeship,
            postcode: serviceLocationsTable.postcode,
            latitude: serviceLocationsTable.latitude,
            longitude: serviceLocationsTable.longitude,
            openingHours: serviceLocationsTable.openingHours,
            phoneNumber: serviceLocationsTable.phoneNumber,
            email: serviceLocationsTable.email,
            webpage: serviceLocationsTable.webpage,
            image: servicesTable.image,
            languages: servicesTable.languages,
            socials: serviceLocationsTable.socials,
            whatsappNumber: serviceLocationsTable.whatsappNumber,
            verified: servicesTable.verified,

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
        .where(isPublicService)
        .orderBy(
            desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        );

    return results as Service[];
}

export type VoivodeshipStats = {
    voivodeship: string;
    companiesCount: number;
    categoriesCount: number;
};

export async function getVoivodeshipStats(): Promise<VoivodeshipStats[]> {
    const rows = await db
        .select({
            voivodeship: serviceLocationsTable.voivodeship,
            companiesCount: sql<number>`COUNT(DISTINCT ${servicesTable.id})::int`.as('companies_count'),
            categoriesCount: sql<number>`COUNT(DISTINCT ${servicesTable.category})::int`.as('categories_count'),
        })
        .from(serviceLocationsTable)
        .innerJoin(servicesTable, and(
            eq(serviceLocationsTable.serviceId, servicesTable.id),
            isPublicService,
        ))
        .where(isNotNull(serviceLocationsTable.voivodeship))
        .groupBy(serviceLocationsTable.voivodeship);

    // `where` odsiewa NULL w SQL, ale typ kolumny tego nie wie — zawezamy tutaj.
    return rows.flatMap(({ voivodeship, ...counts }) => (voivodeship ? [{ voivodeship, ...counts }] : []));
}

export type CatalogStats = {
    companiesCount: number;
    citiesCount: number;
};

export async function getCatalogStats(): Promise<CatalogStats> {
    const [row] = await db
        .select({
            companiesCount: sql<number>`COUNT(DISTINCT ${servicesTable.id})::int`,
            citiesCount: sql<number>`COUNT(DISTINCT LOWER(NULLIF(TRIM(${serviceLocationsTable.city}), '')))::int`,
        })
        .from(servicesTable)
        .leftJoin(serviceLocationsTable, eq(serviceLocationsTable.serviceId, servicesTable.id))
        .where(isPublicService);

    return row ?? { companiesCount: 0, citiesCount: 0 };
}

const FEATURED_CANDIDATES_LIMIT = 3;

function selectFeaturedCandidates(locale: string) {
    return db
        .select({
            serviceId: servicesTable.id,
            name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`,
            category: servicesTable.category,
            city: sql<string | null>`
              (
                SELECT ${serviceLocationsTable.city}
                FROM ${serviceLocationsTable}
                WHERE ${serviceLocationsTable.serviceId} = ${servicesTable.id}
                ORDER BY ${serviceLocationsTable.isMainLocation} DESC
                LIMIT 1
              )
            `,
        })
        .from(servicesTable)
        .leftJoin(
            servicesTranslationsAlias,
            and(
                eq(servicesTranslationsAlias.serviceId, servicesTable.id),
                eq(servicesTranslationsAlias.languageCode, locale),
            ),
        )
        .leftJoin(serviceEngagementsTable, eq(servicesTable.id, serviceEngagementsTable.serviceId))
        .where(isPublicService)
        .$dynamic();
}

export async function getFeaturedServices(locale: string): Promise<FeaturedService[]> {
    const [popular, newest] = await Promise.all([
        selectFeaturedCandidates(locale)
            .orderBy(desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`))
            .limit(FEATURED_CANDIDATES_LIMIT),
        selectFeaturedCandidates(locale)
            .orderBy(desc(servicesTable.createdAt))
            .limit(FEATURED_CANDIDATES_LIMIT),
    ]);

    return pickFeaturedServices(popular, newest);
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
            slug: serviceLocationsTable.slug,

            name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`.as(
                'name',
            ),

            description: servicesTranslationsAlias.description,

            category: servicesTable.category,
            coverage: servicesTable.coverage,
            city: serviceLocationsTable.city,
            street: serviceLocationsTable.street,
            voivodeship: serviceLocationsTable.voivodeship,
            postcode: serviceLocationsTable.postcode,
            latitude: serviceLocationsTable.latitude,
            longitude: serviceLocationsTable.longitude,
            openingHours: serviceLocationsTable.openingHours,
            phoneNumber: serviceLocationsTable.phoneNumber,
            email: serviceLocationsTable.email,
            webpage: serviceLocationsTable.webpage,
            image: servicesTable.image,
            languages: servicesTable.languages,
            socials: serviceLocationsTable.socials,
            whatsappNumber: serviceLocationsTable.whatsappNumber,
            verified: servicesTable.verified,

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
        .where(isPublicService)
        .orderBy(
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        )
        .limit(5);

    return results as Service[];
}
