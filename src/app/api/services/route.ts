import { NextRequest, NextResponse } from 'next/server';
import {
    promotedServicesTable,
    serviceEngagementsTable,
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTranslationsTable,
    voivodeshipEnum,
} from '@/db/schema';
import OpenAI from 'openai';
import { and, eq, sql, desc, gt } from 'drizzle-orm';
import { PartialService } from '@/types';
import { db } from '@/db';
import { createContextualQuery, isCategory } from '@/lib/category-contexts';
import { RELEVANCE_FLOOR, selectRelevant } from '@/lib/search-relevance';
import { env } from '../../../../env';

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

type Voivodeship = (typeof voivodeshipEnum.enumValues)[number];

const VOIVODESHIPS: ReadonlySet<string> = new Set<string>(voivodeshipEnum.enumValues);

function isVoivodeship(value: string | null | undefined): value is Voivodeship {
    return value !== null && value !== undefined && VOIVODESHIPS.has(value);
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

        // Obecnosc OPENAI_API_KEY gwarantuje walidacja Zod w env.ts przy starcie —
        // osobny guard w handlerze bylby martwym kodem.

        const startTime = Date.now();

        const contextualQuery = createContextualQuery(query.trim(), category);

        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: contextualQuery,
        });

        const queryEmbedding = response.data[0].embedding;
        const embeddingVector = `[${queryEmbedding.join(',')}]`;

        const whereConditions = [];

        if (excludeIds.length > 0) {
            whereConditions.push(sql`${servicesTable.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`);
        }

        // Lista dozwolonych kategorii pochodzi z `categoryEnum`, a nie z recznej
        // tablicy. Poprzednia wersja wyliczala dziesiec z czternastu wartosci, wiec
        // filtr po `gastronomy`, `real_estate`, `help_support` i `it` byl po cichu
        // ignorowany — uzytkownik zawezal kategorie i dostawal wyniki ze wszystkich.
        if (isCategory(category)) {
            whereConditions.push(eq(servicesTable.category, category));
        }

        if (isVoivodeship(voivodeship)) {
            whereConditions.push(eq(serviceLocationsTable.voivodeship, voivodeship));
        }

        // Drugi warunek liczy prog juz w SQL, zeby `DISTINCT ON` nizej pracowal na
        // garstce wierszy, a nie na calej tabeli. Autorytatywne odsianie i tak robi
        // `selectRelevant` — to jest zawezenie zbioru, nie druga regula.
        whereConditions.push(
            sql`${serviceLocationsTable.embedding} IS NOT NULL`,
            sql`1 - (${serviceLocationsTable.embedding} <=> ${embeddingVector}::vector) >= ${RELEVANCE_FLOOR}`,
        );

        // `DISTINCT ON (services.id)` zwraca najlepiej dopasowana lokalizacje KAZDEJ
        // firmy, po jednej. Bez tego firma z wieloma oddzialami zjadala cala liste:
        // zapytanie o sklep zwracalo trzy razy ten sam sklep w trzech miastach zamiast
        // trzech roznych. Powiekszenie puli tego nie zalatwia — najwieksze wpisy maja
        // po 32 lokalizacje, wiec kazdy staly mnoznik da sie zaglodzic.
        //
        // Postgres wymaga, by ORDER BY zaczynal sie od wyrazenia z DISTINCT ON, wiec
        // wiersze wracaja uporzadkowane po id; kolejnosc wynikowa ustawia `selectRelevant`.
        const results = await db
            .selectDistinctOn([servicesTable.id], {
                id: serviceLocationsTable.id,
                serviceId: servicesTable.id,
                slug: serviceLocationsTable.slug,
                name: servicesTable.name,
                category: servicesTable.category,
                coverage: servicesTable.coverage,
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
                verified: servicesTable.verified,
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
                servicesTable.id,
                desc(sql`1 - (${serviceLocationsTable.embedding} <=> ${embeddingVector}::vector)`),
                desc(sql`COALESCE(${activePromotions.priority}, 0)`),
                desc(sql`COALESCE(${totalClicks.clicks}, 0)`)
            );

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

        const candidates: (PartialService & { relevanceScore: number })[] = results
            .map(service => {
                const serviceTranslations = translations.filter(t => t.serviceId === service.serviceId);
                const preferredTranslation = serviceTranslations.find(t => t.languageCode === locale)
                    || serviceTranslations[0];

                const serviceTags = tags
                    .filter(t => t.serviceId === service.serviceId && t.languageCode === locale)
                    .map(t => t.tagName)
                    .filter(Boolean);

                return {
                    id: service.id,
                    serviceId: service.serviceId,
                    slug: service.slug,
                    name: preferredTranslation?.name || service.name,
                    category: service.category,
                    coverage: service.coverage,
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
                    verified: service.verified,
                    description: preferredTranslation?.description || null,
                    tags: serviceTags,
                    relevanceScore: service.relevanceScore,
                };
            });

        // Odsianie wynikow spoza wybranej kategorii robi juz `whereConditions` w SQL,
        // wiec nie ma tu drugiej reguly na to samo. Poprzednia wersja miala warunek
        // `relevanceScore > 0.85` dla innej kategorii — martwy kod przy zapytaniu
        // z kategoria i nieosiagalny prog bez niej.
        const services = selectRelevant(candidates, query, category, limit);

        // `executionTime` wraca w odpowiedzi (nizej), wiec liczymy je nadal.
        const executionTime = Date.now() - startTime;

        // Wyniki punktowe sluza tylko do odsiania i ustawienia kolejnosci — na zewnatrz
        // nie wychodza. Podkreslenie w nazwie, bo to celowo odrzucone pola.
        const finalServices = services.map(({ relevanceScore: _score, boostedScore: _boosted, ...service }) => service);

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
            relevanceThreshold: RELEVANCE_FLOOR,
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
