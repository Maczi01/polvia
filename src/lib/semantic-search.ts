import { and, desc, eq, gt, type SQL, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import 'server-only';

import { db } from '@/db';
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
import { createContextualQuery, isCategory } from '@/lib/category-contexts';
import { RELEVANCE_FLOOR, selectRelevant } from '@/lib/search-relevance';
import { judgeRelevance, RelevanceJudgeError } from '@/lib/semantic-relevance-judge';
import { PartialService } from '@/types';

import { env } from '../../env';

/**
 * Wyszukiwanie semantyczne po embeddingach lokalizacji.
 *
 * Wydzielone z `/api/services`, zeby skrypt `db:measure-search` mierzyl dokladnie te
 * sama sciezke co endpoint. Rate limiting i walidacja wejscia zostaja w route handlerze —
 * to granica systemu, a ta funkcja zaklada juz zwalidowane parametry.
 */

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small';

/** Tyle wynikow dostaje ekran mapy — klient nie przekazuje `limit` do `/api/services`. */
export const DEFAULT_SEMANTIC_LIMIT = 3;

/**
 * Tylu najlepszych kandydatow ocenia model. Wiecej niz `limit`, bo odrzuceni zwalniaja
 * miejsca: przed ocena trafny wynik z pozycji 4 przegrywal z nietrafnym z pozycji 1.
 */
const JUDGE_POOL_SIZE = 10;

type Voivodeship = (typeof voivodeshipEnum.enumValues)[number];

const VOIVODESHIPS: ReadonlySet<string> = new Set<string>(voivodeshipEnum.enumValues);

function isVoivodeship(value: string | null | undefined): value is Voivodeship {
    return value !== null && value !== undefined && VOIVODESHIPS.has(value);
}

export type SemanticSearchParams = {
    query: string;
    category?: string | null;
    voivodeship?: string | null;
    locale: string;
    limit: number;
    /** Id firm (`services.id`) pokazanych juz na ekranie. */
    excludeIds: string[];
};

type Candidate = PartialService & { relevanceScore: number };

/** Wynik z punktacja — publiczny endpoint ja odcina, skrypt pomiaru ja wypisuje. */
export type SemanticMatch = Candidate & { boostedScore: number };

/**
 * `passed` — wyniki ocenil model. `unavailable` — ocena zawiodla i wyniki sa
 * nieocenionym rankingiem podobienstwa (patrz `keepJudgedRelevant`).
 */
export type RelevanceCheck = 'passed' | 'unavailable';

export type SemanticSearchResult = {
    services: SemanticMatch[];
    contextualQuery: string;
    relevanceCheck: RelevanceCheck;
};

async function embedQuery(contextualQuery: string): Promise<string> {
    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: contextualQuery,
    });

    return `[${response.data[0].embedding.join(',')}]`;
}

function buildWhereConditions(
    embeddingVector: string,
    { category, voivodeship, excludeIds }: SemanticSearchParams,
): SQL[] {
    const whereConditions: SQL[] = [];

    if (excludeIds.length > 0) {
        whereConditions.push(
            sql`${servicesTable.id} NOT IN (${sql.join(
                excludeIds.map(id => sql`${id}`),
                sql`, `,
            )})`,
        );
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

    return whereConditions;
}

async function findClosestLocations(embeddingVector: string, whereConditions: SQL[]) {
    const activePromotions = db
        .select({
            serviceId: promotedServicesTable.serviceId,
            priority: sql`MAX(${promotedServicesTable.priority})`.as('priority'),
        })
        .from(promotedServicesTable)
        .where(gt(promotedServicesTable.expiresAt, sql`NOW()`))
        .groupBy(promotedServicesTable.serviceId)
        .as('active_promotions');

    const totalClicks = db
        .select({
            serviceId: serviceEngagementsTable.serviceId,
            clicks: sql`SUM(${serviceEngagementsTable.clicks})`.as('clicks'),
        })
        .from(serviceEngagementsTable)
        .groupBy(serviceEngagementsTable.serviceId)
        .as('total_clicks');

    const similarity = sql`1 - (${serviceLocationsTable.embedding} <=> ${embeddingVector}::vector)`;

    // `DISTINCT ON (services.id)` zwraca najlepiej dopasowana lokalizacje KAZDEJ
    // firmy, po jednej. Bez tego firma z wieloma oddzialami zjadala cala liste:
    // zapytanie o sklep zwracalo trzy razy ten sam sklep w trzech miastach zamiast
    // trzech roznych. Powiekszenie puli tego nie zalatwia — najwieksze wpisy maja
    // po 32 lokalizacje, wiec kazdy staly mnoznik da sie zaglodzic.
    //
    // Postgres wymaga, by ORDER BY zaczynal sie od wyrazenia z DISTINCT ON, wiec
    // wiersze wracaja uporzadkowane po id; kolejnosc wynikowa ustawia `selectRelevant`.
    return db
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
            relevanceScore: sql<number>`${similarity}`.as('relevanceScore'),
        })
        .from(servicesTable)
        .innerJoin(serviceLocationsTable, eq(servicesTable.id, serviceLocationsTable.serviceId))
        .leftJoin(activePromotions, eq(servicesTable.id, activePromotions.serviceId))
        .leftJoin(totalClicks, eq(servicesTable.id, totalClicks.serviceId))
        .where(and(...whereConditions))
        .orderBy(
            servicesTable.id,
            desc(similarity),
            desc(sql`COALESCE(${activePromotions.priority}, 0)`),
            desc(sql`COALESCE(${totalClicks.clicks}, 0)`),
        );
}

type ClosestLocation = Awaited<ReturnType<typeof findClosestLocations>>[number];

async function loadTranslationsAndTags(serviceIds: string[]) {
    if (serviceIds.length === 0) return { translations: [], tags: [] };

    const idList = sql.join(
        serviceIds.map(id => sql`${id}`),
        sql`, `,
    );

    const translations = await db
        .select({
            serviceId: servicesTranslationsTable.serviceId,
            name: servicesTranslationsTable.name,
            description: servicesTranslationsTable.description,
            languageCode: servicesTranslationsTable.languageCode,
        })
        .from(servicesTranslationsTable)
        .where(sql`${servicesTranslationsTable.serviceId} IN (${idList})`);

    const tags = await db
        .select({
            serviceId: servicesTagsTable.serviceId,
            tagName: tagsTranslationsTable.name,
            languageCode: tagsTranslationsTable.languageCode,
        })
        .from(servicesTagsTable)
        .innerJoin(tagsTranslationsTable, eq(servicesTagsTable.tagId, tagsTranslationsTable.tagId))
        .where(sql`${servicesTagsTable.serviceId} IN (${idList})`);

    return { translations, tags };
}

type TranslationsAndTags = Awaited<ReturnType<typeof loadTranslationsAndTags>>;

function toCandidate(
    service: ClosestLocation,
    { translations, tags }: TranslationsAndTags,
    locale: string,
): Candidate {
    const serviceTranslations = translations.filter(t => t.serviceId === service.serviceId);
    const preferredTranslation =
        serviceTranslations.find(t => t.languageCode === locale) || serviceTranslations[0];

    const serviceTags = tags
        .filter(t => t.serviceId === service.serviceId && t.languageCode === locale)
        .map(t => t.tagName)
        .filter(Boolean);

    const { priority: _priority, clicks: _clicks, ...location } = service;

    return {
        ...location,
        name: preferredTranslation?.name || service.name,
        description: preferredTranslation?.description || null,
        tags: serviceTags,
    };
}

export async function searchServicesSemantic(
    params: SemanticSearchParams,
): Promise<SemanticSearchResult> {
    const { query, category, locale, limit } = params;
    const contextualQuery = createContextualQuery(query.trim(), category);

    const embeddingVector = await embedQuery(contextualQuery);
    const locations = await findClosestLocations(
        embeddingVector,
        buildWhereConditions(embeddingVector, params),
    );
    const related = await loadTranslationsAndTags(locations.map(r => r.serviceId));

    const candidates = locations.map(location => toCandidate(location, related, locale));

    // Odsianie wynikow spoza wybranej kategorii robi juz `buildWhereConditions` w SQL,
    // wiec nie ma tu drugiej reguly na to samo.
    const ranked = selectRelevant(candidates, query, category, Math.max(limit, JUDGE_POOL_SIZE));
    const judged = await keepJudgedRelevant(query, ranked, limit);

    return { ...judged, contextualQuery };
}

async function keepJudgedRelevant(
    query: string,
    ranked: SemanticMatch[],
    limit: number,
): Promise<Omit<SemanticSearchResult, 'contextualQuery'>> {
    try {
        const relevantIds = await judgeRelevance(openai, query, ranked);
        const services = ranked.filter(match => relevantIds.has(match.id)).slice(0, limit);
        return { services, relevanceCheck: 'passed' };
    } catch (error) {
        if (!(error instanceof RelevanceJudgeError)) throw error;
        // Bez oceny ekran dostaje ranking jak przed wprowadzeniem modelu — slabszy, ale
        // pusta sekcja przy awarii OpenAI bylaby gorsza. Stan wraca do wolajacego.
        console.error('Relevance judge unavailable', { code: error.code, message: error.message });
        return { services: ranked.slice(0, limit), relevanceCheck: 'unavailable' };
    }
}
