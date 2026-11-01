import 'server-only';

import { and, eq, type InferSelectModel, isNotNull, ne, type SQL, sql } from 'drizzle-orm';

import { db } from '@/db';
import { servicesTranslationsAlias } from '@/db/aliases';
import {
    serviceLocationsTable,
    serviceProfilesTable,
    servicesTable,
    serviceSubscriptionsTable,
    servicesTagsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import { isPremiumActive, type PremiumSubscriptionState } from '@/lib/premium';
import { isPublicService } from '@/lib/public-service-filter';
import { type LocalizedPremiumContent, toPremiumContent } from '@/lib/service-profile-premium';
import {
    SIMILAR_SERVICES_LIMIT,
    type SimilarServiceRow,
    type SimilarServicesSource,
} from '@/lib/similar-services';

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
    /**
     * Opublikowana tresc premium w danym locale, niezalezna od stanu subskrypcji (R18).
     * `null`: brak tresci albo zapisany jsonb nie przechodzi walidacji (blad w logu).
     */
    premiumContent: LocalizedPremiumContent | null;
    /**
     * Stan subskrypcji tej uslugi — wejscie `isPremiumActive`. `null`: brak subskrypcji.
     * Czytany w tym samym zapytaniu co profil, wiec zawsze dotyczy wpisu spod `slug`.
     */
    subscription: PremiumSubscriptionState | null;
};

export type ServiceSlugStatus = {
    exists: boolean;
    /** `isPremiumActive` w chwili zapytania; `false` dla nieistniejacego wpisu. */
    hasActivePremium: boolean;
};

export type { SimilarServiceRow } from '@/lib/similar-services';

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

/**
 * Stan subskrypcji przy left joinie: obiekt, ktory Drizzle zamienia na `null`, gdy wpis
 * nie ma wiersza `service_subscriptions`. Ksztalt = wejscie `isPremiumActive`.
 */
export const subscriptionColumns = {
    status: serviceSubscriptionsTable.status,
    currentPeriodEnd: serviceSubscriptionsTable.currentPeriodEnd,
    cancelAtPeriodEnd: serviceSubscriptionsTable.cancelAtPeriodEnd,
};

/**
 * Join subskrypcji WYLACZNIE po `service_id` tego wpisu — subskrypcja innej uslugi nie moze
 * wlaczyc premium. Wspolny dla profilu i lookupu, zeby warunek byl jeden.
 */
export const subscriptionJoin = eq(serviceSubscriptionsTable.serviceId, servicesTable.id);

/** Czy pod `/firma/<slug>` jest aktywny wpis i czy ma aktywne premium. Lekkie zapytanie lookupu. */
export async function getServiceSlugStatus(
    slug: string,
    now: Date = new Date(),
): Promise<ServiceSlugStatus> {
    const [row] = await db
        .select({ id: servicesTable.id, subscription: subscriptionColumns })
        .from(servicesTable)
        .leftJoin(serviceSubscriptionsTable, subscriptionJoin)
        .where(and(eq(servicesTable.slug, slug), isPublicService))
        .limit(1);

    if (!row) return { exists: false, hasActivePremium: false };

    return { exists: true, hasActivePremium: isPremiumActive(row.subscription, now) };
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

/**
 * Lokalizacje aktywnego wpisu po slugu uslugi. Po slugu, a nie po `id`, zeby szly
 * rownolegle z zapytaniem o sam wpis (jeden round-trip mniej na kazde wejscie na profil).
 */
function getServiceLocations(slug: string): Promise<ServiceProfileLocation[]> {
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
        .innerJoin(servicesTable, eq(servicesTable.id, serviceLocationsTable.serviceId))
        .where(and(eq(servicesTable.slug, slug), isPublicService))
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
    const [[service], locations] = await Promise.all([
        getServiceRow(slug, locale),
        getServiceLocations(slug),
    ]);

    if (!service) return null;

    const { premium, ...row } = service;
    const premiumContent = toPremiumContent(premium, {
        serviceId: row.id,
        slug,
        locale,
        name: row.name,
    });

    return { ...row, slug, locations, premiumContent };
}

function getServiceRow(slug: string, locale: string) {
    return db
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
            // Obiekt przy left joinie: brak wiersza `service_profiles` daje `premium: null`.
            premium: {
                template: serviceProfilesTable.template,
                coverImage: serviceProfilesTable.coverImage,
                gallery: serviceProfilesTable.gallery,
                priceList: serviceProfilesTable.priceList,
                faq: serviceProfilesTable.faq,
            },
            subscription: subscriptionColumns,
        })
        .from(servicesTable)
        .leftJoin(servicesTranslationsAlias, translationJoin(locale))
        .leftJoin(serviceProfilesTable, eq(serviceProfilesTable.serviceId, servicesTable.id))
        .leftJoin(serviceSubscriptionsTable, subscriptionJoin)
        .where(and(eq(servicesTable.slug, slug), isPublicService))
        .limit(1);
}

/**
 * `true`, gdy glowne miasto kandydata to miasto zrodla (bez wielkosci liter i spacji na
 * brzegach). `COALESCE`, bo `NULL` (kandydat bez miasta) w `ORDER BY … DESC` trafilby
 * na poczatek listy. Zrodlo bez miasta niczego nie promuje.
 */
function isSameCity(city: string | null): SQL<boolean> {
    const sourceCity = city?.trim() ?? '';
    if (sourceCity === '') return sql<boolean>`false`;

    return sql<boolean>`COALESCE(lower(btrim(${mainCity})) = lower(${sourceCity}), false)`;
}

/**
 * „Podobne firmy” dla profilu: aktywne wpisy tej samej kategorii, bez samego wpisu,
 * najpierw z miasta glownej lokalizacji zrodla, potem alfabetycznie — sortowanie i limit
 * w SQL. Celowo bez rankingu premium: kolejnosc ma byc prosta i przewidywalna.
 *
 * Miasto kandydata to skorelowane podzapytanie `mainCity` (indeks
 * `idx_location_service_main`), a nie join na `is_main_location = true`: dane maja wpisy
 * z dwiema glownymi lokalizacjami (join zdublowalby firme) i bez zadnej (zniknelaby z listy).
 */
export async function getSimilarServices(
    { serviceId, category, city }: SimilarServicesSource,
    locale: string,
): Promise<SimilarServiceRow[]> {
    // Wpis bez slugu (przed backfillem) nie ma adresu profilu.
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
                eq(servicesTable.category, category),
                ne(servicesTable.id, serviceId),
                isNotNull(servicesTable.slug),
            ),
        )
        .orderBy(sql`${isSameCity(city)} DESC`, localizedName, servicesTable.id)
        .limit(SIMILAR_SERVICES_LIMIT);

    // `where` odsiewa NULL w SQL, ale typ kolumny tego nie wie — zawezamy tutaj.
    return rows.flatMap(({ slug, ...row }) => (slug === null ? [] : [{ ...row, slug }]));
}
