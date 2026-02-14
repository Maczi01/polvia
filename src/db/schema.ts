import {
    alias, boolean,
    doublePrecision,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uuid,
    varchar,
    vector,
} from 'drizzle-orm/pg-core';

export const categoryEnum = pgEnum('category', [
    'others',
    'education',
    'renovation',
    'financial',
    'beauty',
    'grocery',
    'transport',
    'law',
    'mechanics',
    'health',
]);

export const countyEnum = pgEnum('county', [
    'Antrim',
    'Armagh',
    'Derry',
    'Down',
    'Fermanagh',
    'Tyrone',
    'Carlow',
    'Cavan',
    'Clare',
    'Cork',
    'Donegal',
    'Dublin',
    'Galway',
    'Kerry',
    'Kildare',
    'Kilkenny',
    'Laois',
    'Leitrim',
    'Limerick',
    'Longford',
    'Louth',
    'Mayo',
    'Meath',
    'Monaghan',
    'Offaly',
    'Roscommon',
    'Sligo',
    'Tipperary',
    'Waterford',
    'Westmeath',
    'Wexford',
    'Wicklow',
]);

export const servicesTable = pgTable('services', {
    id: serial('id').primaryKey(),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: categoryEnum('category').notNull(),
    // tags: text('tags'),
    city: varchar('city', { length: 255 }),
    street: varchar('street', { length: 255 }),
    county: countyEnum('county'),
    postcode: varchar('postcode', { length: 20 }),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    openingHours: text('openingHours').notNull(),
    phoneNumber: varchar('phoneNumber', { length: 50 }),
    email: varchar('email', { length: 255 }),
    webpage: varchar('webpage', { length: 255 }),
    part: varchar('part', { length: 255 }),
    image: varchar('image', { length: 255 }),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    // TODO code below will be used later for translations descriptions, tags and names
    // defaultName: varchar('default_name', { length: 255 }).notNull(),
});

export const promotedServicesTable = pgTable('promoted_services', {
    serviceId: integer('service_id')
        .primaryKey()
        .references(() => servicesTable.id),
    priority: integer('priority').notNull().default(1),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const serviceEngagementsTable = pgTable('service_engagements', {
    id: serial('id').primaryKey(),
    serviceId: integer('service_id')
        .notNull()
        .references(() => servicesTable.id),
    clicks: integer('clicks').default(0).notNull(),
});

export const servicesTranslationsTable = pgTable('services_translations', {
    id: serial('id').primaryKey(),
    serviceId: integer('service_id')
        .references(() => servicesTable.id) // foreign key to services
        .notNull(),
    languageCode: varchar('language_code', { length: 2 }).notNull(), // e.g. 'en', 'pl', etc.
    name: varchar('name', { length: 255 }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const servicesTranslationsAlias = alias(
    servicesTranslationsTable,
    'services_translations_alias'
);

export const tagsTable = pgTable('tags', {
    id: serial('id').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
});

export const tagsTranslationsTable = pgTable('tags_translations', {
    id: serial('id').primaryKey(),
    tagId: integer('tag_id')
        .notNull()
        .references(() => tagsTable.id),
    languageCode: varchar('language_code', { length: 2 }).notNull(), // 'en', 'pl', etc.
    name: text('name').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
});

export const servicesTagsTable = pgTable('services_tags', {
    serviceId: integer('service_id')
        .notNull()
        .references(() => servicesTable.id),
    tagId: integer('tag_id')
        .notNull()
        .references(() => tagsTable.id),
});

export const newsletter = pgTable('newsletter_subscribers', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    isActive: boolean('is_active').default(true),
    source: varchar('source', { length: 50 }).default('banner')
});

