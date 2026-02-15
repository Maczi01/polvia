import { alias } from 'drizzle-orm/pg-core';
import { servicesTranslationsTable } from './schema';

export const servicesTranslationsAlias = alias(
    servicesTranslationsTable,
    'services_translations_alias'
);