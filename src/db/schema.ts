import {
    boolean,
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

export const categoryEnum = pgEnum('category', [
    'others',
    'education',
    'renovation',
    'financial',
    'grocery',
    'beauty',
    'gastronomy',
    'transport',
    'law',
    'mechanics',
    'health',
    'entertainment',
]);

export const voivodeshipEnum = pgEnum('voivodeship', [
    'dolnoslaskie',
    'kujawsko-pomorskie',
    'lubelskie',
    'lubuskie',
    'lodzkie',
    'malopolskie',
    'mazowieckie',
    'opolskie',
    'podkarpackie',
    'podlaskie',
    'pomorskie',
    'slaskie',
    'swietokrzyskie',
    'warminsko-mazurskie',
    'wielkopolskie',
    'zachodniopomorskie',
]);

export const statusEnum = pgEnum('status', [
    'active',
    'inactive',
    'pending',
    'confirmed'
]);

export const servicesTable = pgTable('services', {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: categoryEnum('category').notNull(),
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
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    openingHours: jsonb('opening_hours').$type<Record<string, { open: string; close: string }>>().notNull(),
    phoneNumber: varchar('phone_number', { length: 50 }),
    email: varchar('email', { length: 255 }),
    webpage: varchar('webpage', { length: 255 }),
    nip: varchar('nip', { length: 10 }),
    socials: jsonb('socials').$type<{
        instagram?: string;
        telegram?: string;
        tiktok?: string;
        facebook?: string;
        youtube?: string;
        viber?: string;
        whatsapp?: string;
        tripadvisor?: string;
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
