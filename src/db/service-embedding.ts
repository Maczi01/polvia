import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

import { env } from '../../env';
import { CATEGORY_CONTEXTS, isCategory } from '../lib/category-contexts';
import { db } from './index';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTranslationsTable,
} from './schema';

/**
 * Embeddingi lokalizacji. Wspolne dla `db:embeddings` i publikacji z panelu, zeby oba
 * tworzyly ten sam tekst dokumentu. Bez `server-only` i aliasu `@/`: uruchamia je tez CLI.
 */

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}

export function buildSearchableText(
    service: { name: string; category: string },
    location: { city: string | null; street: string | null; voivodeship: string | null },
    translations: { languageCode: string; name: string | null; description: string | null }[],
    tags: { languageCode: string; name: string }[],
): string {
    const parts: string[] = [`Service: ${service.name}`, `Category: ${service.category}`];

    // `service.category` przychodzi z bazy jako `string`, wiec przed indeksowaniem
    // mapy musi przejsc przez straznika — inaczej literowka w kolumnie cicho dawalaby
    // dokument bez kontekstu kategorii.
    if (isCategory(service.category)) {
        parts.push(`Context: ${CATEGORY_CONTEXTS[service.category]}`);
    }

    if (location.city) parts.push(`City: ${location.city}`);
    if (location.voivodeship) parts.push(`Voivodeship: ${location.voivodeship}`);
    if (location.street) parts.push(`Address: ${location.street}`);

    // Group translations by language so multi-lang content is clearly separated
    const byLang = new Map<string, { names: string[]; descriptions: string[] }>();
    for (const t of translations) {
        const entry = byLang.get(t.languageCode) ?? { names: [], descriptions: [] };
        byLang.set(t.languageCode, entry);
        if (t.name && t.name !== service.name) entry.names.push(t.name);
        if (t.description) entry.descriptions.push(t.description);
    }

    for (const [lang, { names, descriptions }] of byLang) {
        if (names.length > 0) parts.push(`Name [${lang}]: ${names.join(', ')}`);
        if (descriptions.length > 0) parts.push(`Description [${lang}]: ${descriptions.join('. ')}`);
    }

    // Group tags by language
    const tagsByLang = new Map<string, string[]>();
    for (const t of tags) {
        const names = tagsByLang.get(t.languageCode) ?? [];
        tagsByLang.set(t.languageCode, names);
        names.push(t.name);
    }

    for (const [lang, tagNames] of tagsByLang) {
        const unique = [...new Set(tagNames)];
        if (unique.length > 0) parts.push(`Tags [${lang}]: ${unique.join(', ')}`);
    }

    return parts.join('. ');
}

export async function findServiceTagTexts(
    serviceId: string,
): Promise<{ name: string; languageCode: string }[]> {
    return db
        .select({
            name: tagsTranslationsTable.name,
            languageCode: tagsTranslationsTable.languageCode,
        })
        .from(servicesTagsTable)
        .innerJoin(tagsTranslationsTable, eq(servicesTagsTable.tagId, tagsTranslationsTable.tagId))
        .where(eq(servicesTagsTable.serviceId, serviceId));
}

/** Zapisuje embeddingi wszystkich lokalizacji jednego wpisu. Blad OpenAI lub bazy rzuca. */
export async function embedServiceLocations(serviceId: string): Promise<void> {
    const [service] = await db
        .select({ name: servicesTable.name, category: servicesTable.category })
        .from(servicesTable)
        .where(eq(servicesTable.id, serviceId))
        .limit(1);
    if (!service) throw new Error(`Service ${serviceId} not found`);

    const [locations, translations, tags] = await Promise.all([
        db
            .select({
                id: serviceLocationsTable.id,
                city: serviceLocationsTable.city,
                street: serviceLocationsTable.street,
                voivodeship: serviceLocationsTable.voivodeship,
            })
            .from(serviceLocationsTable)
            .where(eq(serviceLocationsTable.serviceId, serviceId)),
        db
            .select({
                languageCode: servicesTranslationsTable.languageCode,
                name: servicesTranslationsTable.name,
                description: servicesTranslationsTable.description,
            })
            .from(servicesTranslationsTable)
            .where(eq(servicesTranslationsTable.serviceId, serviceId)),
        findServiceTagTexts(serviceId),
    ]);

    for (const location of locations) {
        const embedding = await generateEmbedding(
            buildSearchableText(service, location, translations, tags),
        );
        await db
            .update(serviceLocationsTable)
            .set({ embedding, updatedAt: new Date() })
            .where(eq(serviceLocationsTable.id, location.id));
    }
}
