import { NextRequest, NextResponse } from 'next/server';
import {
    promotedServicesTable,
    serviceEngagementsTable,
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTranslationsTable,
} from '@/db/schema';
import OpenAI from 'openai';
import { and, eq, sql, desc, gt } from 'drizzle-orm';
import { PartialService } from '@/types';
import { db } from '@/db';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Category context mapping for better embeddings
const CATEGORY_CONTEXTS = {
    grocery: "grocery, supermarket, food shopping, retail, convenience store, market food, restaurant, dining, cuisine, catering, grocery, beverages, cooking, nutrition",
    transport: "transportation, travel, vehicles, logistics, shipping, delivery, public transport, taxi, rideshare, automotive services",
    financial: "finance, banking, insurance, investment, accounting, loans, financial planning",
    renovation: "construction, home improvement, building, repair, maintenance, contractors",
    law: "legal services, lawyers, attorneys, legal advice, court, litigation, contracts",
    beauty: "beauty, cosmetics, skincare, haircare, spa, wellness, aesthetics, grooming",
    government: "government services, public administration, civic services, municipal, local government, public sector",
    health: "healthcare, medical, wellness, fitness, pharmacy, therapy, mental health, dental",
    mechanics: "automotive repair, machinery, technical services, maintenance, engineering",
    entertainment: "entertainment, leisure, events, activities, arts, culture, music, cinema, sports",
    education: "education, learning, training, courses, schools, tutoring, skills development",
    others: "general services, miscellaneous, various, other categories"
} as const;

// Relevance threshold for filtering out low-quality matches
const RELEVANCE_THRESHOLD = 0.8;

function createContextualQuery(query: string, category?: string | undefined | null): string {
    if (!category || !CATEGORY_CONTEXTS[category as keyof typeof CATEGORY_CONTEXTS]) {
        return query;
    }
    const categoryContext = CATEGORY_CONTEXTS[category as keyof typeof CATEGORY_CONTEXTS];
    return `${query} in the context of ${category}: ${categoryContext}`;
}

function calculateRelevanceBoost(service: any, query: string, category?: string | undefined | null): number {
    let boost = 1;

    if (category && service.category === category) {
        boost += 0.3;
    }

    const queryTerms = query.toLowerCase().split(' ');
    const serviceName = service.name.toLowerCase();
    const matchingTerms = queryTerms.filter(term => serviceName.includes(term));
    boost += (matchingTerms.length / queryTerms.length) * 0.2;

    return boost;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');
        const category = searchParams.get('category');
        const voivodeship = searchParams.get('voivodeship');
        const locale = searchParams.get('locale') || 'en';
        const limit = Number.parseInt(searchParams.get('limit') || '3');
        const excludeIdsParam = searchParams.get('excludeIds');

        const activePromotions = db
            .select({
                serviceId: promotedServicesTable.serviceId,
                priority: sql`MAX(${promotedServicesTable.priority})`.as('priority')
            })
            .from(promotedServicesTable)
            .where(gt(promotedServicesTable.expiresAt, sql`NOW()`))
            .groupBy(promotedServicesTable.serviceId)
            .as('active_promotions');

        const totalClicks = db
            .select({
                serviceId: serviceEngagementsTable.serviceId,
                clicks: sql`SUM(${serviceEngagementsTable.clicks})`.as('clicks')
            })
            .from(serviceEngagementsTable)
            .groupBy(serviceEngagementsTable.serviceId)
            .as('total_clicks');

        const excludeIds: string[] = excludeIdsParam
            ? excludeIdsParam.split(',').map(id => id.trim()).filter(Boolean)
            : [];

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: 'Query parameter is required for embedding search' },
                { status: 400 }
            );
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            );
        }

        const startTime = Date.now();
        console.log(`Embedding search for: "${query}" in category: "${category || 'any'}" (excluding ${excludeIds.length} IDs)`);

        const contextualQuery = createContextualQuery(query.trim(), category);
        console.log(`Contextual query: "${contextualQuery}"`);

        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: contextualQuery,
        });

        const queryEmbedding = response.data[0].embedding;
        const embeddingVector = `[${queryEmbedding.join(',')}]`;

        const whereConditions = [];

        if (excludeIds.length > 0) {
            whereConditions.push(sql`${servicesTable.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`);
        }

        if (category) {
            const validCategories = ['others', 'education', 'renovation', 'financial', 'beauty', 'grocery', 'transport', 'law', 'mechanics', 'health'] as const;
            if (validCategories.includes(category as any)) {
                whereConditions.push(eq(servicesTable.category, category as any));
            }
        }

        whereConditions.push(sql`${serviceLocationsTable.embedding} IS NOT NULL`);

        const results = await db
            .select({
                id: serviceLocationsTable.id,
                serviceId: servicesTable.id,
                slug: serviceLocationsTable.slug,
                name: servicesTable.name,
                category: servicesTable.category,
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
                image: servicesTable.image,
                languages: servicesTable.languages,
                socials: serviceLocationsTable.socials,
                whatsappNumber: serviceLocationsTable.whatsappNumber,
                priority: sql<number>`COALESCE(${activePromotions.priority}, 0)`.as('priority'),
                clicks: sql<number>`COALESCE(${totalClicks.clicks}, 0)`.as('clicks'),
                relevanceScore: sql<number>`1 - (${serviceLocationsTable.embedding} <=> ${embeddingVector}::vector)`.as('relevanceScore')
            })
            .from(servicesTable)
            .innerJoin(serviceLocationsTable, eq(servicesTable.id, serviceLocationsTable.serviceId))
            .leftJoin(activePromotions, eq(servicesTable.id, activePromotions.serviceId))
            .leftJoin(totalClicks, eq(servicesTable.id, totalClicks.serviceId))
            .where(and(...whereConditions))
            .orderBy(
                desc(sql`1 - (${serviceLocationsTable.embedding} <=> ${embeddingVector}::vector)`),
                desc(sql`priority`),
                desc(sql`clicks`)
            )
            .limit(limit * 2);

        const serviceIds = results.map(r => r.serviceId);

        const translations = serviceIds.length > 0 ? await db
                .select({
                    serviceId: servicesTranslationsTable.serviceId,
                    name: servicesTranslationsTable.name,
                    description: servicesTranslationsTable.description,
                    languageCode: servicesTranslationsTable.languageCode
                })
                .from(servicesTranslationsTable)
                .where(sql`${servicesTranslationsTable.serviceId} IN (${sql.join(serviceIds.map(id => sql`${id}`), sql`, `)})`)
            : [];

        const tags = serviceIds.length > 0 ? await db
                .select({
                    serviceId: servicesTagsTable.serviceId,
                    tagName: tagsTranslationsTable.name,
                    languageCode: tagsTranslationsTable.languageCode
                })
                .from(servicesTagsTable)
                .innerJoin(tagsTranslationsTable, eq(servicesTagsTable.tagId, tagsTranslationsTable.tagId))
                .where(sql`${servicesTagsTable.serviceId} IN (${sql.join(serviceIds.map(id => sql`${id}`), sql`, `)})`)
            : [];

        const services: (PartialService & { relevanceScore: number; boostedScore: number })[] = results
            .map(service => {
                const serviceTranslations = translations.filter(t => t.serviceId === service.serviceId);
                const preferredTranslation = serviceTranslations.find(t => t.languageCode === locale)
                    || serviceTranslations[0];

                const serviceTags = tags
                    .filter(t => t.serviceId === service.serviceId && t.languageCode === locale)
                    .map(t => t.tagName)
                    .filter(Boolean);

                const relevanceBoost = calculateRelevanceBoost(service, query, category);
                const boostedScore = service.relevanceScore * relevanceBoost;

                return {
                    id: service.id,
                    serviceId: service.serviceId,
                    slug: service.slug,
                    name: preferredTranslation?.name || service.name,
                    category: service.category,
                    city: service.city,
                    street: service.street,
                    voivodeship: service.voivodeship,
                    postcode: service.postcode,
                    latitude: service.latitude,
                    longitude: service.longitude,
                    openingHours: service.openingHours,
                    phoneNumber: service.phoneNumber,
                    email: service.email,
                    webpage: service.webpage,
                    image: service.image,
                    languages: service.languages,
                    socials: service.socials,
                    whatsappNumber: service.whatsappNumber,
                    description: preferredTranslation?.description || null,
                    tags: serviceTags,
                    relevanceScore: service.relevanceScore,
                    boostedScore
                };
            })
            .filter(service => {
                if (service.relevanceScore < RELEVANCE_THRESHOLD) {
                    return false;
                }

                if (category && service.category !== category) {
                    return service.relevanceScore > 0.85;
                }

                return true;
            })
            .sort((a, b) => b.boostedScore - a.boostedScore)
            .slice(0, limit);

        const executionTime = Date.now() - startTime;
        console.log(`Embedding search completed: ${services.length} results (${executionTime}ms)`);

        if (services.length > 0) {
            console.log('Top embedding results:');
            services.slice(0, 3).forEach((service, index) => {
                console.log(`  ${index + 1}. ${service.name} (${service.category}) - Score: ${service.boostedScore.toFixed(4)} (base: ${service.relevanceScore.toFixed(4)})`);
            });
        }

        const finalServices = services.map(({ relevanceScore, boostedScore, ...service }) => service);

        return NextResponse.json({
            success: true,
            services: finalServices,
            query,
            contextualQuery,
            locale,
            excludedIds: excludeIds,
            filters: {
                category,
                voivodeship
            },
            count: finalServices.length,
            executionTime,
            relevanceThreshold: RELEVANCE_THRESHOLD,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Embedding search API error:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Embedding search failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
