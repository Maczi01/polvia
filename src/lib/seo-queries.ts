import { db } from '@/db';
import {
    promotedServicesTable,
    serviceEngagementsTable,
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    tagsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import { servicesTranslationsAlias } from '@/db/aliases';
import { and, desc, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import 'server-only';
import type { Service } from '@/types';
import type { CitySlug, CategoryKey } from '@/lib/slug-mappings';
import { getCityRawMatches } from '@/lib/slug-mappings';
import type { categoryEnum } from '@/db/schema';

// CategoryKey includes 'government' which is not in the DB enum.
// This type extracts the valid DB category values for use in queries.
type DbCategory = (typeof categoryEnum.enumValues)[number];

/**
 * Shared select fields for service location queries.
 * Mirrors the pattern from queries.ts to return the same Service shape.
 */
function serviceSelectFields(locale: string) {
    return {
        id: serviceLocationsTable.id,
        serviceId: servicesTable.id,
        slug: serviceLocationsTable.slug,
        name: sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`.as('name'),
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
            JOIN ${tagsTable} t ON t.id = st.tag_id
            JOIN ${tagsTranslationsTable} ttt ON ttt.tag_id = t.id
            WHERE st.service_id = ${servicesTable.id}
              AND ttt.language_code = ${locale}
          )
        `.as('tags'),
    };
}

/**
 * Base query builder with standard joins (same as queries.ts pattern).
 */
function baseServiceQuery(locale: string) {
    return db
        .select(serviceSelectFields(locale))
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
        .leftJoin(serviceEngagementsTable, eq(servicesTable.id, serviceEngagementsTable.serviceId));
}

/**
 * Get all active service locations in a city.
 */
export async function getServiceLocationsByCity(
    citySlug: CitySlug,
    locale: string,
): Promise<Service[]> {
    const rawMatches = getCityRawMatches(citySlug);
    if (rawMatches.length === 0) return [];

    const results = await baseServiceQuery(locale)
        .where(
            and(
                inArray(serviceLocationsTable.city, rawMatches),
                eq(servicesTable.status, 'active'),
            ),
        )
        .orderBy(
            desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        );

    return results as Service[];
}

/**
 * Get active service locations in a city filtered by category.
 */
export async function getServiceLocationsByCityAndCategory(
    citySlug: CitySlug,
    category: CategoryKey,
    locale: string,
): Promise<Service[]> {
    const rawMatches = getCityRawMatches(citySlug);
    if (rawMatches.length === 0) return [];

    const results = await baseServiceQuery(locale)
        .where(
            and(
                inArray(serviceLocationsTable.city, rawMatches),
                eq(servicesTable.category, category as DbCategory),
                eq(servicesTable.status, 'active'),
            ),
        )
        .orderBy(
            desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        );

    return results as Service[];
}

/**
 * Get category distribution for a city (for "top categories" section on city pages).
 */
export async function getCategoriesByCity(
    citySlug: CitySlug,
): Promise<{ category: string; count: number }[]> {
    const rawMatches = getCityRawMatches(citySlug);
    if (rawMatches.length === 0) return [];

    return db
        .select({
            category: servicesTable.category,
            count: sql<number>`COUNT(DISTINCT ${servicesTable.id})`.as('count'),
        })
        .from(serviceLocationsTable)
        .innerJoin(
            servicesTable,
            and(
                eq(serviceLocationsTable.serviceId, servicesTable.id),
                eq(servicesTable.status, 'active'),
            ),
        )
        .where(inArray(serviceLocationsTable.city, rawMatches))
        .groupBy(servicesTable.category)
        .orderBy(desc(sql`count`)) as unknown as { category: string; count: number }[];
}

/**
 * Get a single service location by its slug (for /firma/[slug] profile pages).
 */
export async function getServiceLocationBySlug(
    slug: string,
    locale: string,
): Promise<Service | null> {
    const results = await baseServiceQuery(locale)
        .where(
            and(
                eq(serviceLocationsTable.slug, slug),
                eq(servicesTable.status, 'active'),
            ),
        )
        .limit(1);

    return (results[0] as Service) ?? null;
}

/**
 * Get related service locations (same category, same city, excluding the current one).
 * Falls back to same category in any city if not enough results.
 */
export async function getRelatedServiceLocations(
    currentLocationId: string,
    category: string,
    city: string | null,
    locale: string,
    limit: number = 6,
): Promise<Service[]> {
    const conditions = [
        eq(servicesTable.status, 'active'),
        eq(servicesTable.category, category as DbCategory),
        ne(serviceLocationsTable.id, currentLocationId),
    ];

    if (city) {
        conditions.push(eq(serviceLocationsTable.city, city));
    }

    const results = await baseServiceQuery(locale)
        .where(and(...conditions))
        .orderBy(
            desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
            desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
        )
        .limit(limit);

    // If we got fewer results with city filter, try without city
    if (results.length < limit && city) {
        const moreResults = await baseServiceQuery(locale)
            .where(
                and(
                    eq(servicesTable.status, 'active'),
                    eq(servicesTable.category, category as DbCategory),
                    ne(serviceLocationsTable.id, currentLocationId),
                ),
            )
            .orderBy(
                desc(sql`COALESCE(${promotedServicesTable.priority}, 0)`),
                desc(sql`COALESCE(${serviceEngagementsTable.clicks}, 0)`),
            )
            .limit(limit);

        // Deduplicate and merge
        const existingIds = new Set(results.map(r => r.id));
        for (const r of moreResults) {
            if (!existingIds.has(r.id) && results.length < limit) {
                results.push(r);
            }
        }
    }

    return results as Service[];
}

/**
 * Get all active service location slugs (for sitemap generation).
 */
export async function getAllActiveServiceLocationSlugs(): Promise<
    { slug: string; updatedAt: Date }[]
> {
    return db
        .select({
            slug: serviceLocationsTable.slug,
            updatedAt: serviceLocationsTable.updatedAt,
        })
        .from(serviceLocationsTable)
        .innerJoin(
            servicesTable,
            and(
                eq(serviceLocationsTable.serviceId, servicesTable.id),
                eq(servicesTable.status, 'active'),
            ),
        )
        .orderBy(serviceLocationsTable.slug);
}
