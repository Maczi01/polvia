import OpenAI from 'openai';
import { eq } from 'drizzle-orm';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import { db } from '@/db';
import { env } from '../../env';

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

// Enhanced category contexts for better embeddings
const CATEGORY_CONTEXTS = {
    transport: "transportation, travel, vehicles, logistics, shipping, delivery, public transport, taxi, rideshare, automotive services",
    food: "food, restaurant, dining, cuisine, catering, grocery, beverages, cooking, nutrition",
    health: "healthcare, medical, wellness, fitness, pharmacy, therapy, mental health, dental",
    beauty: "beauty, cosmetics, skincare, haircare, spa, wellness, aesthetics, grooming",
    education: "education, learning, training, courses, schools, tutoring, skills development",
    financial: "finance, banking, insurance, investment, accounting, loans, financial planning",
    law: "legal services, lawyers, attorneys, legal advice, court, litigation, contracts",
    mechanics: "automotive repair, machinery, technical services, maintenance, engineering",
    renovation: "construction, home improvement, building, repair, maintenance, contractors",
    grocery: "grocery, supermarket, food shopping, retail, convenience store, market",
    others: "general services, miscellaneous, various, other categories"
} as const;

// Enhanced function to generate embeddings
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });

        return response.data[0].embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

// Enhanced searchable text creation with category context
export function createSearchableText(
    service: any,
    translations?: any[],
    tags?: any[]
): string {
    const categoryContext = CATEGORY_CONTEXTS[service.category as keyof typeof CATEGORY_CONTEXTS] || '';

    // Structure the text for better semantic understanding
    const parts = [
        // Primary service information
        `Service: ${service.name}`,

        // Category with context
        `Category: ${service.category}`,
        categoryContext ? `Context: ${categoryContext}` : '',

        // Location information (important for local search)
        service.city ? `City: ${service.city}` : '',
        service.county ? `County: ${service.county}` : '',
        service.street ? `Address: ${service.street}` : '',
    ];

    // Add translations with language labels
    if (translations && translations.length > 0) {
        translations.forEach(translation => {
            if (translation.name && translation.name !== service.name) {
                parts.push(`Name (${translation.languageCode}): ${translation.name}`);
            }
            if (translation.description) {
                parts.push(`Description (${translation.languageCode}): ${translation.description}`);
            }
        });
    }

    // Add tags with better context
    if (tags && tags.length > 0) {
        const tagNames = tags
            .filter(tag => tag.name)
            .map(tag => tag.name)
            .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates

        if (tagNames.length > 0) {
            parts.push(`Tags: ${tagNames.join(', ')}`);
        }
    }

    return parts.filter(Boolean).join('. ');
}

// Enhanced function to regenerate embeddings for all services
export async function generateEmbeddingsForAllServices(forceRegenerate = false) {
    console.log('🚀 Starting embedding generation for all services...');
    console.log(`🔄 Force regenerate: ${forceRegenerate}`);

    // Get all locations with their service data and translations
    const locations = await db
        .select()
        .from(serviceLocationsTable)
        .innerJoin(servicesTable, eq(serviceLocationsTable.serviceId, servicesTable.id))
        .leftJoin(
            servicesTranslationsTable,
            eq(servicesTable.id, servicesTranslationsTable.serviceId)
        );

    if (locations.length === 0) {
        console.log('❌ No service locations found in database');
        return;
    }

    // Group locations with their translations
    const locationsMap = new Map();
    locations.forEach(row => {
        const location = row.service_locations;
        const service = row.services;
        const translation = row.services_translations;

        if (!locationsMap.has(location.id)) {
            locationsMap.set(location.id, {
                location,
                service,
                translations: []
            });
        }

        if (translation) {
            locationsMap.get(location.id).translations.push(translation);
        }
    });

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const total = locationsMap.size;

    console.log(`📊 Found ${total} service locations to process`);

    for (const [locationId, { location, service, translations }] of locationsMap) {
        try {
            // Skip if embedding already exists and not forcing regeneration
            if (location.embedding && !forceRegenerate) {
                console.log(`⏭️  Skipping location ${locationId} - embedding already exists`);
                skipped++;
                continue;
            }

            console.log(`🔄 Processing location ${locationId}: "${service.name}" (${service.category})`);

            // Get tags for this service
            const tagsData = await db
                .select({
                    name: tagsTranslationsTable.name,
                    languageCode: tagsTranslationsTable.languageCode,
                })
                .from(servicesTagsTable)
                .innerJoin(
                    tagsTranslationsTable,
                    eq(servicesTagsTable.tagId, tagsTranslationsTable.tagId)
                )
                .where(eq(servicesTagsTable.serviceId, service.id));

            // Create enhanced searchable text
            const searchableText = createSearchableText({ ...service, city: location.city, street: location.street }, translations, tagsData);
            console.log(`📝 Searchable text (${searchableText.length} chars): "${searchableText.slice(0, 150)}..."`);

            // Generate embedding
            const embedding = await generateEmbedding(searchableText);
            console.log(`✅ Generated embedding with ${embedding.length} dimensions`);

            // Save embedding to database
            await db
                .update(serviceLocationsTable)
                .set({
                    embedding: embedding,
                    updatedAt: new Date()
                })
                .where(eq(serviceLocationsTable.id, locationId));

            processed++;
            console.log(`✅ Saved embedding for location ${locationId} (${processed}/${total - skipped})`);

            // Progress logging
            if (processed % 10 === 0) {
                console.log(`📈 Progress: ${processed} processed, ${skipped} skipped, ${errors} errors`);
            }

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`❌ Error processing location ${locationId}:`, error);
            errors++;

            // Handle rate limiting
            if (error instanceof Error && error.message?.includes('rate limit')) {
                console.log('⏰ Rate limit hit, waiting 10 seconds...');
                await new Promise(resolve => setTimeout(resolve, 10_000));
                continue;
            }
        }
    }

    console.log(`🎉 Finished embedding generation!`);
    console.log(`   ✅ Processed: ${processed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${total}`);

    return { processed, skipped, errors, total };
}

// Enhanced single location embedding generation
export async function generateEmbeddingForLocation(locationId: string) {
    console.log(`🔄 Generating embedding for location ${locationId}`);

    // Get comprehensive location data
    const locationData = await db
        .select({
            locationId: serviceLocationsTable.id,
            locationCity: serviceLocationsTable.city,
            locationStreet: serviceLocationsTable.street,
            locationVoivodeship: serviceLocationsTable.voivodeship,
            serviceId: servicesTable.id,
            serviceName: servicesTable.name,
            serviceCategory: servicesTable.category,
            translationName: servicesTranslationsTable.name,
            translationDescription: servicesTranslationsTable.description,
            translationLanguage: servicesTranslationsTable.languageCode,
            tagName: tagsTranslationsTable.name,
            tagLanguage: tagsTranslationsTable.languageCode,
        })
        .from(serviceLocationsTable)
        .innerJoin(
            servicesTable,
            eq(serviceLocationsTable.serviceId, servicesTable.id)
        )
        .leftJoin(
            servicesTranslationsTable,
            eq(servicesTable.id, servicesTranslationsTable.serviceId)
        )
        .leftJoin(
            servicesTagsTable,
            eq(servicesTable.id, servicesTagsTable.serviceId)
        )
        .leftJoin(
            tagsTranslationsTable,
            eq(servicesTagsTable.tagId, tagsTranslationsTable.tagId)
        )
        .where(eq(serviceLocationsTable.id, locationId));

    if (locationData.length === 0) {
        throw new Error(`Location with ID ${locationId} not found`);
    }

    const service = {
        id: locationData[0].serviceId,
        name: locationData[0].serviceName,
        category: locationData[0].serviceCategory,
        city: locationData[0].locationCity,
        street: locationData[0].locationStreet,
        county: locationData[0].locationVoivodeship,
    };

    const translations = locationData
        .filter(row => row.translationName)
        .map(row => ({
            name: row.translationName,
            description: row.translationDescription,
            languageCode: row.translationLanguage,
        }))
        .filter((t, index, self) =>
                index === self.findIndex(item =>
                    item.name === t.name && item.languageCode === t.languageCode
                )
        );

    const tags = locationData
        .filter(row => row.tagName)
        .map(row => ({
            name: row.tagName,
            languageCode: row.tagLanguage,
        }))
        .filter((t, index, self) =>
                index === self.findIndex(item =>
                    item.name === t.name && item.languageCode === t.languageCode
                )
        );

    // Generate enhanced embedding
    const searchableText = createSearchableText(service, translations, tags);
    console.log(`📝 Enhanced searchable text: "${searchableText.slice(0, 200)}..."`);

    const embedding = await generateEmbedding(searchableText);

    await db
        .update(serviceLocationsTable)
        .set({
            embedding: embedding,
            updatedAt: new Date()
        })
        .where(eq(serviceLocationsTable.id, locationId));

    console.log(`✅ Updated embedding for location ${locationId}: "${service.name}" (${service.category})`);
    console.log(`   📝 Included ${translations.length} translations and ${tags.length} tags`);

    return embedding;
}

// Utility function to test embedding generation
export async function testEmbeddingGeneration() {
    try {
        console.log('🧪 Testing embedding generation...');

        // Test OpenAI connection
        await generateEmbedding('test connection');
        console.log('✅ OpenAI connection successful');

        // Test with sample service data
        const sampleService = {
            name: 'Test Transport Service',
            category: 'transport',
            city: 'Dublin',
            county: 'Dublin'
        };

        const sampleTranslations = [
            { name: 'Test Transport Service', description: 'A reliable transport service', languageCode: 'en' }
        ];

        const sampleTags = [
            { name: 'reliable', languageCode: 'en' },
            { name: 'fast', languageCode: 'en' }
        ];

        const searchableText = createSearchableText(sampleService, sampleTranslations, sampleTags);
        console.log(`📝 Sample searchable text: "${searchableText}"`);

        const embedding = await generateEmbedding(searchableText);
        console.log(`✅ Generated test embedding with ${embedding.length} dimensions`);

        return true;
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}