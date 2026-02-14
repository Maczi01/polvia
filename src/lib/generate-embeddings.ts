// apiKey: "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",

import OpenAI from 'openai';
import { eq } from 'drizzle-orm';
import {
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import { db } from '@/db';

const openai = new OpenAI({
    apiKey: "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",
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

    // Get all services with their translations
    const services = await db
        .select()
        .from(servicesTable)
        .leftJoin(
            servicesTranslationsTable,
            eq(servicesTable.id, servicesTranslationsTable.serviceId)
        );

    if (services.length === 0) {
        console.log('❌ No services found in database');
        return;
    }

    // Group services with their translations
    const servicesMap = new Map();
    services.forEach(row => {
        const service = row.services;
        const translation = row.services_translations;

        if (!servicesMap.has(service.id)) {
            servicesMap.set(service.id, {
                service,
                translations: []
            });
        }

        if (translation) {
            servicesMap.get(service.id).translations.push(translation);
        }
    });

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const total = servicesMap.size;

    console.log(`📊 Found ${total} services to process`);

    for (const [serviceId, { service, translations }] of servicesMap) {
        try {
            // Skip if embedding already exists and not forcing regeneration
            if (service.embedding && !forceRegenerate) {
                console.log(`⏭️  Skipping service ${serviceId} - embedding already exists`);
                skipped++;
                continue;
            }

            console.log(`🔄 Processing service ${serviceId}: "${service.name}" (${service.category})`);

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
                .where(eq(servicesTagsTable.serviceId, serviceId));

            // Create enhanced searchable text
            const searchableText = createSearchableText(service, translations, tagsData);
            console.log(`📝 Searchable text (${searchableText.length} chars): "${searchableText.slice(0, 150)}..."`);

            // Generate embedding
            const embedding = await generateEmbedding(searchableText);
            console.log(`✅ Generated embedding with ${embedding.length} dimensions`);

            // Save embedding to database
            await db
                .update(servicesTable)
                .set({
                    embedding: embedding,
                    updatedAt: new Date()
                })
                .where(eq(servicesTable.id, serviceId));

            processed++;
            console.log(`✅ Saved embedding for service ${serviceId} (${processed}/${total - skipped})`);

            // Progress logging
            if (processed % 10 === 0) {
                console.log(`📈 Progress: ${processed} processed, ${skipped} skipped, ${errors} errors`);
            }

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error(`❌ Error processing service ${serviceId}:`, error);
            errors++;

            // Handle rate limiting
            if (error instanceof Error && error.message?.includes('rate limit')) {
                console.log('⏰ Rate limit hit, waiting 10 seconds...');
                await new Promise(resolve => setTimeout(resolve, 10_000));
                // Retry this service
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

// Enhanced single service embedding generation
export async function generateEmbeddingForService(serviceId: number) {
    console.log(`🔄 Generating embedding for service ${serviceId}`);

    // Get comprehensive service data
    const serviceData = await db
        .select({
            serviceId: servicesTable.id,
            serviceName: servicesTable.name,
            serviceCategory: servicesTable.category,
            serviceCity: servicesTable.city,
            serviceStreet: servicesTable.street,
            serviceCounty: servicesTable.county,
            translationName: servicesTranslationsTable.name,
            translationDescription: servicesTranslationsTable.description,
            translationLanguage: servicesTranslationsTable.languageCode,
            tagName: tagsTranslationsTable.name,
            tagLanguage: tagsTranslationsTable.languageCode,
        })
        .from(servicesTable)
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
        .where(eq(servicesTable.id, serviceId));

    if (serviceData.length === 0) {
        throw new Error(`❌ Service with ID ${serviceId} not found`);
    }

    // Process the data
    const service = {
        id: serviceData[0].serviceId,
        name: serviceData[0].serviceName,
        category: serviceData[0].serviceCategory,
        city: serviceData[0].serviceCity,
        street: serviceData[0].serviceStreet,
        county: serviceData[0].serviceCounty,
    };

    const translations = serviceData
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

    const tags = serviceData
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
        .update(servicesTable)
        .set({
            embedding: embedding,
            updatedAt: new Date()
        })
        .where(eq(servicesTable.id, serviceId));

    console.log(`✅ Updated embedding for service ${serviceId}: "${service.name}" (${service.category})`);
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