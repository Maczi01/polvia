import 'server-only';

import { and, eq, type InferSelectModel, isNotNull, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { servicesTranslationsAlias } from '@/db/aliases';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import { isPublicService } from '@/lib/public-service-filter';
import { pickSimilarServices, type SimilarService } from '@/lib/similar-services';

type ServiceRow = InferSelectModel<typeof servicesTable>;
type LocationRow = InferSelectModel<typeof serviceLocationsTable>;

export type ServiceProfileLocation = Pick<
    LocationRow,
    | 'id'
    | 'slug'
    | 'city'
    | 'street'
    | 'voivodeship'
    | 'postcode'
    | 'latitude'
    | 'longitude'
    | 'openingHours'
    | 'phoneNumber'
    | 'email'
    | 'webpage'
    | 'socials'
    | 'whatsappNumber'
    | 'isMainLocation'
>;

export type ServiceProfile = Pick<
    ServiceRow,
    'id' | 'category' | 'coverage' | 'languages' | 'verified' | 'image'
> & {
    slug: string;
    /** Nazwa w danym locale (fallback: `services.name`). */
    name: string;
    /** Opis w danym locale; `null`, gdy brak tlumaczenia. */
    description: string | null;
    /** Nazwy tagow w danym locale, alfabetycznie. */
    tags: string[];
    /** Glowna lokalizacja pierwsza. Wpis `online` moze miec `latitude`/`longitude` = null. */
    locations: ServiceProfileLocation[];
};

export type ServiceSlugStatus = { exists: boolean };

export type { SimilarService } from '@/lib/similar-services';

/** Nazwa w locale z fallbackiem na nazwe bazowa — ten sam wzorzec co `getServices`. */
const localizedName = sql<string>`COALESCE(${servicesTranslationsAlias.name}, ${servicesTable.name})`;

function translationJoin(locale: string) {
    return and(
        eq(servicesTranslationsAlias.serviceId, servicesTable.id),
        eq(servicesTranslationsAlias.languageCode, locale),
    );
}

/**
 * Miasto glownej lokalizacji, a gdy zadna nie jest glowna — pierwszej po slugu.
 * Ta sama kolejnosc co lista lokalizacji profilu.
 */
const mainCity = sql<string | null>`
  (
    SELECT ${serviceLocationsTable.city}
    FROM ${serviceLocationsTable}
    WHERE ${serviceLocationsTable.serviceId} = ${servicesTable.id}
    ORDER BY ${serviceLocationsTable.isMainLocation} DESC, ${serviceLocationsTable.slug}
    LIMIT 1
  )
`;

function tagsInLocale(locale: string) {
    return sql<string[]>`
      COALESCE(
        (
          SELECT array_agg(${tagsTranslationsTable.name} ORDER BY ${tagsTranslationsTable.name})
          FROM ${servicesTagsTable}
          JOIN ${tagsTranslationsTable}
            ON ${tagsTranslationsTable.tagId} = ${servicesTagsTable.tagId}
          WHERE ${servicesTagsTable.serviceId} = ${servicesTable.id}
            AND ${tagsTranslationsTable.languageCode} = ${locale}
        ),
        ARRAY[]::text[]
      )
    `;
}

/** Czy pod `/firma/<slug>` jest aktywny wpis. Lekkie zapytanie dla lookupu w middleware. */
export async function getServiceSlugStatus(slug: string): Promise<ServiceSlugStatus> {
    const [row] = await db
        .select({ id: servicesTable.id })
        .from(servicesTable)
        .where(and(eq(servicesTable.slug, slug), isPublicService))
        .limit(1);

    return { exists: row !== undefined };
}

export type ServiceProfileSitemapEntry = { slug: string; updatedAt: Date };

/** Slugi aktywnych wpisow z adresem profilu — dla sitemapy. Wpis bez slugu nie ma profilu. */
export async function getServiceProfileSitemapEntries(): Promise<ServiceProfileSitemapEntry[]> {
    const rows = await db
        .select({ slug: servicesTable.slug, updatedAt: servicesTable.updatedAt })
        .from(servicesTable)
        .where(and(isPublicService, isNotNull(servicesTable.slug)));

    // `where` odsiewa NULL w SQL, ale typ kolumny tego nie wie — zawezamy tutaj.
    return rows.flatMap(({ slug, updatedAt }) => (slug === null ? [] : [{ slug, updatedAt }]));
}

function getServiceLocations(serviceId: string): Promise<ServiceProfileLocation[]> {
    return db
        .select({
            id: serviceLocationsTable.id,
            slug: serviceLocationsTable.slug,
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
            socials: serviceLocationsTable.socials,
            whatsappNumber: serviceLocationsTable.whatsappNumber,
            isMainLocation: serviceLocationsTable.isMainLocation,
        })
        .from(serviceLocationsTable)
        .where(eq(serviceLocationsTable.serviceId, serviceId))
        .orderBy(sql`${serviceLocationsTable.isMainLocation} DESC`, serviceLocationsTable.slug);
}

/**
 * Komplet danych darmowego profilu `/firma/<slug>` albo `null`, gdy pod slugiem
 * nie ma aktywnego wpisu (`pending`/`inactive` sa niepubliczne).
 */
export async function getServiceProfile(
    slug: string,
    locale: string,
): Promise<ServiceProfile | null> {
    const [service] = await db
        .select({
            id: servicesTable.id,
            name: localizedName,
            description: servicesTranslationsAlias.description,
            category: servicesTable.category,
            coverage: servicesTable.coverage,
            languages: servicesTable.languages,
            verified: servicesTable.verified,
            image: servicesTable.image,
            tags: tagsInLocale(locale),
        })
        .from(servicesTable)
        .leftJoin(servicesTranslationsAlias, translationJoin(locale))
        .where(and(eq(servicesTable.slug, slug), isPublicService))
        .limit(1);

    if (!service) return null;

    const locations = await getServiceLocations(service.id);

    return { ...service, slug, locations };
}

/**
 * „Podobne firmy” dla profilu: aktywne wpisy tej samej kategorii, najpierw z miasta
 * glownej lokalizacji. Dobor i kolejnosc: `pickSimilarServices`.
 */
export async function getSimilarServices(
    serviceId: string,
    locale: string,
): Promise<SimilarService[]> {
    const [source] = await db
        .select({ serviceId: servicesTable.id, category: servicesTable.category, city: mainCity })
        .from(servicesTable)
        .where(eq(servicesTable.id, serviceId))
        .limit(1);

    if (!source) return [];

    // Bez LIMIT: kategoria liczy dziesiatki wpisow, a „to samo miasto najpierw”
    // wymaga calej kategorii. Wpis bez slugu (przed backfillem) nie ma adresu profilu.
    const rows = await db
        .select({
            serviceId: servicesTable.id,
            slug: servicesTable.slug,
            name: localizedName,
            image: servicesTable.image,
            city: mainCity,
            category: servicesTable.category,
        })
        .from(servicesTable)
        .leftJoin(servicesTranslationsAlias, translationJoin(locale))
        .where(
            and(
                isPublicService,
                eq(servicesTable.category, source.category),
                ne(servicesTable.id, serviceId),
                isNotNull(servicesTable.slug),
            ),
        );

    // `where` odsiewa NULL w SQL, ale typ kolumny tego nie wie — zawezamy tutaj.
    const candidates = rows.flatMap(({ slug, ...row }) => (slug === null ? [] : [{ ...row, slug }]));

    return pickSimilarServices(source, candidates);
}
