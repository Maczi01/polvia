import { eq } from 'drizzle-orm';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTranslationsTable,
} from '../db/schema';
import { db } from '../db';
import { buildSearchableText, findServiceTagTexts, generateEmbedding } from './service-embedding';

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
        // eslint-disable-next-line unicorn/no-process-exit
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
            const tagsData = await findServiceTagTexts(service.id);

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
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
    console.error('Fatal error:', error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
});