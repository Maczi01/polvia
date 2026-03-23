import OpenAI from 'openai';
import { eq, isNull } from 'drizzle-orm';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTranslationsTable,
} from '../db/schema';
import { db } from '../db';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const CATEGORY_CONTEXTS: Record<string, string> = {
    transport: 'transportation, travel, vehicles, logistics, shipping, delivery, public transport, taxi, rideshare',
    health: 'healthcare, medical, wellness, fitness, pharmacy, therapy, mental health, dental',
    beauty: 'beauty, cosmetics, skincare, haircare, spa, wellness, aesthetics, grooming',
    education: 'education, learning, training, courses, schools, tutoring, skills development',
    financial: 'finance, banking, insurance, investment, accounting, loans, financial planning',
    law: 'legal services, lawyers, attorneys, legal advice, court, litigation, contracts',
    mechanics: 'automotive repair, machinery, technical services, maintenance, engineering',
    renovation: 'construction, home improvement, building, repair, maintenance, contractors',
    grocery: 'grocery, supermarket, food shopping, retail, convenience store, market',
    gastronomy: 'food, restaurant, dining, cuisine, catering, beverages, cooking, nutrition',
    real_estate: 'real estate, property, housing, apartments, rental, buying, selling, mortgage',
    help_support: 'help, support, assistance, aid, charity, social services, counseling',
    others: 'general services, miscellaneous, various',
};

async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}

function buildSearchableText(
    service: { name: string; category: string },
    location: { city: string | null; street: string | null; voivodeship: string | null },
    translations: { languageCode: string; name: string | null; description: string | null }[],
    tags: { languageCode: string; name: string }[],
): string {
    const parts: string[] = [
        `Service: ${service.name}`,
        `Category: ${service.category}`,
    ];

    const ctx = CATEGORY_CONTEXTS[service.category];
    if (ctx) parts.push(`Context: ${ctx}`);

    if (location.city) parts.push(`City: ${location.city}`);
    if (location.voivodeship) parts.push(`Voivodeship: ${location.voivodeship}`);
    if (location.street) parts.push(`Address: ${location.street}`);

    // Group translations by language so multi-lang content is clearly separated
    const byLang = new Map<string, { names: string[]; descriptions: string[] }>();
    for (const t of translations) {
        if (!byLang.has(t.languageCode)) {
            byLang.set(t.languageCode, { names: [], descriptions: [] });
        }
        const entry = byLang.get(t.languageCode)!;
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
        if (!tagsByLang.has(t.languageCode)) tagsByLang.set(t.languageCode, []);
        tagsByLang.get(t.languageCode)!.push(t.name);
    }

    for (const [lang, tagNames] of tagsByLang) {
        const unique = [...new Set(tagNames)];
        if (unique.length > 0) parts.push(`Tags [${lang}]: ${unique.join(', ')}`);
    }

    return parts.join('. ');
}

async function main() {
    const forceRegenerate = process.argv.includes('--force');

    console.log('Starting embedding generation...');
    if (forceRegenerate) console.log('Force mode: regenerating ALL embeddings');

    // Fetch all locations joined with services and translations
    const rows = await db
        .select()
        .from(serviceLocationsTable)
        .innerJoin(servicesTable, eq(serviceLocationsTable.serviceId, servicesTable.id))
        .leftJoin(servicesTranslationsTable, eq(servicesTable.id, servicesTranslationsTable.serviceId));

    if (rows.length === 0) {
        console.log('No service locations found.');
        process.exit(0);
    }

    // Group by location
    const locationsMap = new Map<string, {
        location: typeof rows[0]['service_locations'];
        service: typeof rows[0]['services'];
        translations: { languageCode: string; name: string | null; description: string | null }[];
    }>();

    for (const row of rows) {
        const loc = row.service_locations;
        const svc = row.services;
        const trans = row.services_translations;

        if (!locationsMap.has(loc.id)) {
            locationsMap.set(loc.id, { location: loc, service: svc, translations: [] });
        }

        if (trans) {
            locationsMap.get(loc.id)!.translations.push({
                languageCode: trans.languageCode,
                name: trans.name,
                description: trans.description,
            });
        }
    }

    const total = locationsMap.size;
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`Found ${total} service locations`);

    for (const [locationId, { location, service, translations }] of locationsMap) {
        try {
            if (location.embedding && !forceRegenerate) {
                skipped++;
                continue;
            }

            // Fetch tags for this service (all languages)
            const tagsData = await db
                .select({
                    name: tagsTranslationsTable.name,
                    languageCode: tagsTranslationsTable.languageCode,
                })
                .from(servicesTagsTable)
                .innerJoin(tagsTranslationsTable, eq(servicesTagsTable.tagId, tagsTranslationsTable.tagId))
                .where(eq(servicesTagsTable.serviceId, service.id));

            const text = buildSearchableText(service, location, translations, tagsData);

            const embedding = await generateEmbedding(text);

            await db
                .update(serviceLocationsTable)
                .set({ embedding, updatedAt: new Date() })
                .where(eq(serviceLocationsTable.id, locationId));

            processed++;
            console.log(`[${processed + skipped}/${total}] ${service.name} (${service.category}) - ${location.city ?? 'no city'}`);

            // Rate limit: ~5 req/s
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            errors++;
            console.error(`Error for location ${locationId}:`, error instanceof Error ? error.message : error);

            if (error instanceof Error && error.message?.includes('rate limit')) {
                console.log('Rate limited, waiting 10s...');
                await new Promise(resolve => setTimeout(resolve, 10_000));
            }
        }
    }

    console.log(`\nDone! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}, Total: ${total}`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});