import {
    boolean,
    customType,
    doublePrecision,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uuid,
    varchar,
    vector,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

import type { ServiceJson } from '../lib/add-business/build-service-json';
import { CATEGORY_VALUES } from '../lib/categories';
import { COVERAGE_VALUES } from '../lib/coverage';
import { SUBSCRIPTION_STATUSES } from '../lib/premium';
import { PREMIUM_TEMPLATES } from '../lib/premium-templates';
import { SERVICE_STATUS_VALUES } from '../lib/service-status';
import { SUBMISSION_STATUSES } from '../lib/submission-status';
import { VOIVODESHIP_VALUES } from '../lib/voivodeships';
import type { OpeningHours } from '../lib/weekdays';
import type {
    PremiumFaqItem,
    PremiumGalleryItem,
    PremiumPriceListItem,
    PremiumRatingItem,
} from './premium-content-schema';

export const categoryEnum = pgEnum('category', CATEGORY_VALUES);

export const voivodeshipEnum = pgEnum('voivodeship', VOIVODESHIP_VALUES);

export const statusEnum = pgEnum('status', SERVICE_STATUS_VALUES);

/** Zasieg obslugi — druga, ortogonalna os obok kategorii (branzy). Opis wartosci: `coverage.ts`. */
export const coverageEnum = pgEnum('coverage', COVERAGE_VALUES);

/** Szablon strony premium. Wartosci i ich opis: `src/lib/premium-templates.ts`. */
export const profileTemplateEnum = pgEnum('profile_template', PREMIUM_TEMPLATES);

/** Status subskrypcji Stripe. Wartosci: `SUBSCRIPTION_STATUSES` w `src/lib/premium.ts`. */
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);

/** Status zgloszenia firmy w panelu. Wartosci: `src/lib/submission-status.ts`. */
export const submissionStatusEnum = pgEnum('submission_status', SUBMISSION_STATUSES);

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const servicesTable = pgTable('services', {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    // Adres profilu `/firma/<slug>`: unikalny i niezmienny (zmiana nazwy nie zmienia adresu).
    // Regula: zawsze z `name` przez `createServiceSlugAllocator` (`service-slugs.ts`) —
    // `buildServiceSlug(name)`, przy kolizji sufiks `-2`, `-3`… — w seedzie, backfillu
    // i `db:add`. `slug` z `data/services/*.json` to tylko baza slugow lokalizacji.
    // Format: `isValidServiceSlug` (`src/lib/service-slug-format.ts`), sprawdzany w middleware.
    // Nullowalny tylko na czas wdrozenia: najpierw `push` z ta kolumna, potem
    // `db:backfill-slugs`, a dopiero potem `.notNull()` w osobnym `push`.
    slug: varchar('slug', { length: 255 }).unique(),
    category: categoryEnum('category').notNull(),
    coverage: coverageEnum('coverage').notNull().default('local'),
    status: statusEnum('status').notNull().default('active'),
    image: varchar('image', { length: 255 }),
    languages: varchar('languages', { length: 5 }).array().notNull().default(sql`ARRAY['pl']::varchar[]`),
    verified: boolean('verified').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const servicesRelations = relations(servicesTable, ({ many }) => ({
    translations: many(servicesTranslationsTable),
    locations: many(serviceLocationsTable),
    tags: many(servicesTagsTable),
    engagements: many(serviceEngagementsTable),
}));

export const serviceLocationsTable = pgTable('service_locations', {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id')
        .notNull()
        .references(() => servicesTable.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 255 }).unique().notNull(),
    city: varchar('city', { length: 255 }),
    street: varchar('street', { length: 255 }),
    voivodeship: voivodeshipEnum('voivodeship'),
    postcode: varchar('postcode', { length: 20 }),
    // Nullowalne: wpis o zasiegu `online` nie musi miec adresu ulicznego ani wspolrzednych
    // (R9). Wiersz lokalizacji istnieje zawsze, bo niesie wymagany `slug` i `city`.
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    openingHours: jsonb('opening_hours').$type<OpeningHours>().notNull(),
    phoneNumber: varchar('phone_number', { length: 50 }),
    email: varchar('email', { length: 255 }),
    webpage: varchar('webpage', { length: 255 }),
    nip: varchar('nip', { length: 10 }),
    socials: jsonb('socials').$type<{
        instagram?: string;
        telegram?: string;
        tiktok?: string;
        facebook?: string;
        linkedin?: string;
        youtube?: string;
        viber?: string;
        whatsapp?: string;
        tripadvisor?: string;
        /** Dawniej Twitter. Klucz `x`, bo taka jest dzis nazwa serwisu i domena. */
        x?: string;
    }>(),
    whatsappNumber: varchar('whatsapp_number', { length: 20 }),
    isMainLocation: boolean('is_main_location').notNull().default(false),
    confirmed: boolean('confirmed').notNull().default(false),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('idx_location_latitude').on(table.latitude),
    index('idx_location_longitude').on(table.longitude),
    index('idx_location_city').on(table.city),
    index('idx_location_voivodeship').on(table.voivodeship),
    // Lokalizacje uslugi i jej glowne miasto (profil, „Podobne firmy”) — bez tego kazde
    // zapytanie po `service_id` to skan calej tabeli.
    index('idx_location_service_main').on(table.serviceId, table.isMainLocation),
]);

export const serviceLocationsRelations = relations(serviceLocationsTable, ({ one }) => ({
    service: one(servicesTable, {
        fields: [serviceLocationsTable.serviceId],
        references: [servicesTable.id],
    }),
}));

export const promotedServicesTable = pgTable('promoted_services', {
    serviceId: uuid('service_id')
        .primaryKey()
        .references(() => servicesTable.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const promotedServicesRelations = relations(promotedServicesTable, ({ one }) => ({
    service: one(servicesTable, {
        fields: [promotedServicesTable.serviceId],
        references: [servicesTable.id],
    }),
}));

/**
 * Tresc strony premium (1:1 z usluga), publikowana przez `db:premium` z bloku `premium`
 * w `data/services/<plik>.json`. Niezalezna od stanu premium: po wygasnieciu zostaje
 * i wraca po wznowieniu (R18). Teksty w jsonb maja wszystkie cztery jezyki; ksztalt
 * pilnuje `premiumContentSchema` na zapisie i na odczycie. Premium reczne: `manual-premium.ts`.
 */
export const serviceProfilesTable = pgTable('service_profiles', {
    serviceId: uuid('service_id')
        .primaryKey()
        .references(() => servicesTable.id, { onDelete: 'cascade' }),
    template: profileTemplateEnum('template').notNull(),
    /** Sama nazwa pliku z `public/services/<slug-uslugi>/`. */
    coverImage: varchar('cover_image', { length: 255 }),
    gallery: jsonb('gallery').$type<PremiumGalleryItem[]>().notNull().default([]),
    priceList: jsonb('price_list').$type<PremiumPriceListItem[]>().notNull().default([]),
    faq: jsonb('faq').$type<PremiumFaqItem[]>().notNull().default([]),
    /** Oceny z innych serwisow, wpisane recznie (`premium.ratings`). Nie trafiaja do JSON-LD. */
    ratings: jsonb('ratings').$type<PremiumRatingItem[]>().notNull().default([]),
    manualPremiumUntil: timestamp('manual_premium_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Stan subskrypcji premium (1:1 z usluga), odwzorowany ze Stripe przez webhook
 * (`syncSubscriptionFromStripe`). Kolumny `status`/`currentPeriod*`/`cancelAtPeriodEnd`
 * to wejscie `isPremiumActive` — premium liczone na odczycie, bez crona. Po `db:reset`
 * stan odtwarza `npm run db:sync-subscriptions`.
 */
export const serviceSubscriptionsTable = pgTable('service_subscriptions', {
    serviceId: uuid('service_id')
        .primaryKey()
        .references(() => servicesTable.id, { onDelete: 'cascade' }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull().unique(),
    status: subscriptionStatusEnum('status').notNull(),
    /** Od niego liczona karencja `past_due` (Stripe przesuwa okres przed nieudanym odnowieniem). */
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Przetworzone zdarzenia webhooka Stripe — deduplikacja ponowien (`id` = `event.id`). */
export const stripeEventsTable = pgTable('stripe_events', {
    id: varchar('id', { length: 255 }).primaryKey(),
    type: varchar('type', { length: 255 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const serviceEngagementsTable = pgTable('service_engagements', {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id')
        .notNull()
        .references(() => servicesTable.id, { onDelete: 'cascade' }),
    clicks: integer('clicks').default(0).notNull(),
});

export const serviceEngagementsRelations = relations(serviceEngagementsTable, ({ one }) => ({
    service: one(servicesTable, {
        fields: [serviceEngagementsTable.serviceId],
        references: [servicesTable.id],
    }),
}));

export const servicesTranslationsTable = pgTable('services_translations', {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceId: uuid('service_id')
        .references(() => servicesTable.id, { onDelete: 'cascade' })
        .notNull(),
    languageCode: varchar('language_code', { length: 2 }).notNull(),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    unique('uq_service_translation_lang').on(table.serviceId, table.languageCode),
]);

export const servicesTranslationsRelations = relations(servicesTranslationsTable, ({ one }) => ({
    service: one(servicesTable, {
        fields: [servicesTranslationsTable.serviceId],
        references: [servicesTable.id],
    }),
}));

export const tagsTable = pgTable('tags', {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
});

export const tagsRelations = relations(tagsTable, ({ many }) => ({
    translations: many(tagsTranslationsTable),
    services: many(servicesTagsTable),
}));

export const tagsTranslationsTable = pgTable('tags_translations', {
    id: uuid('id').defaultRandom().primaryKey(),
    tagId: uuid('tag_id')
        .notNull()
        .references(() => tagsTable.id, { onDelete: 'cascade' }),
    languageCode: varchar('language_code', { length: 2 }).notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    unique('uq_tag_translation_lang').on(table.tagId, table.languageCode),
]);

export const tagsTranslationsRelations = relations(tagsTranslationsTable, ({ one }) => ({
    tag: one(tagsTable, {
        fields: [tagsTranslationsTable.tagId],
        references: [tagsTable.id],
    }),
}));

export const servicesTagsTable = pgTable('services_tags', {
    serviceId: uuid('service_id')
        .notNull()
        .references(() => servicesTable.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
        .notNull()
        .references(() => tagsTable.id, { onDelete: 'cascade' }),
}, (table) => [
    primaryKey({ columns: [table.serviceId, table.tagId] }),
]);

export const servicesTagsRelations = relations(servicesTagsTable, ({ one }) => ({
    service: one(servicesTable, {
        fields: [servicesTagsTable.serviceId],
        references: [servicesTable.id],
    }),
    tag: one(tagsTable, {
        fields: [servicesTagsTable.tagId],
        references: [tagsTable.id],
    }),
}));

export const newsletterTable = pgTable('newsletter_subscribers', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    isActive: boolean('is_active').default(true),
    source: varchar('source', { length: 50 }).default('banner'),
});

/**
 * Zgloszenia z formularza „Dodaj firme" czekajace na reczna publikacje przez `db:add`.
 * Bez relacji do `services`: to poczekalnia, wpis powstaje dopiero z pliku w `data/services/`.
 * Logo w bazie, bo system plikow Vercela jest efemeryczny; po `sharp` to PNG do 512 px.
 * `submitter_email` i `notes` to dane osobowe zglaszajacego — tylko dla panelu.
 *
 * RLS wlaczone bez polityk: role inne niz wlasciciel tabeli (aplikacja laczy sie jako wlasciciel)
 * nie czytaja wierszy. Bez `enableRLS()` `drizzle-kit push` proponuje je wylaczyc.
 */
export const serviceSubmissionsTable = pgTable('service_submissions', {
    id: uuid('id').defaultRandom().primaryKey(),
    status: submissionStatusEnum('status').notNull().default('new'),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    entry: jsonb('entry').$type<ServiceJson>().notNull(),
    unconfirmed: text('unconfirmed').array().notNull(),
    changedByOwner: text('changed_by_owner').array().notNull(),
    missingCoordinates: boolean('missing_coordinates').notNull(),
    manualPin: boolean('manual_pin').notNull(),
    submitterEmail: varchar('submitter_email', { length: 255 }).notNull(),
    notes: text('notes'),
    /** Zgoda na jednorazowa informacje o premium w mailu; bez niej mail nie moze jej zawierac. */
    premiumInfoConsent: boolean('premium_info_consent').notNull().default(false),
    locale: varchar('locale', { length: 5 }).notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    sourceUrl: text('source_url'),
    logo: bytea('logo'),
    /** Ostatnia odpowiedz z panelu; `null` = nic nie wyslano. Nie zmienia `updatedAt` (retencja). */
    replySentAt: timestamp('reply_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export type { Coverage } from '../lib/coverage';
