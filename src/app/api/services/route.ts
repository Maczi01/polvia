import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { RELEVANCE_FLOOR } from '@/lib/search-relevance';
import { DEFAULT_SEMANTIC_LIMIT, searchServicesSemantic } from '@/lib/semantic-search';

/**
 * Endpoint jest publiczny i kazde trafienie kosztuje jeden embedding w OpenAI,
 * a w odpowiedzi jada dane kontaktowe firm. 30 zapytan na minute miesci reczne
 * szukanie z naddatkiem, ale odbiera sens zbieraniu katalogu skryptem.
 */
const SEARCH_RATE_LIMIT = {
    maxRequestsPerIp: 30,
    windowSeconds: 60,
};

/** Ile wynikow wolno wyciagnac jednym zapytaniem. */
const MAX_LIMIT = 50;

/**
 * `searchParams.get()` oddaje `null` dla parametru nieobecnego i `''` dla pustego,
 * a `.default()` w Zodzie reaguje wylacznie na `undefined`. Bez tej normalizacji
 * `?limit=` przechodziloby przez `z.coerce.number()` jako 0.
 */
function emptyToUndefined(value: string | null): string | undefined {
    return value === null || value.trim() === '' ? undefined : value;
}

const QUERY_REQUIRED = 'Query parameter is required for embedding search';

const searchQuerySchema = z.object({
    // Ten sam komunikat dla parametru nieobecnego, `null` i pustego — z punktu
    // widzenia konsumenta API to jeden i ten sam blad, a poprzednia wersja
    // endpointu zwracala dokladnie to zdanie.
    query: z
        .string({
            required_error: QUERY_REQUIRED,
            invalid_type_error: QUERY_REQUIRED,
        })
        .trim()
        .min(1, QUERY_REQUIRED)
        .max(200),
    category: z.string().max(50).nullish(),
    voivodeship: z.string().max(50).nullish(),
    locale: z.string().max(5).default('en'),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_SEMANTIC_LIMIT),
    excludeIds: z.string().max(2000).nullish(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Limit stoi PRZED walidacja i przed jakakolwiek praca: kazde zapytanie
        // placi za embedding w OpenAI, wiec licznik chroni nie tylko dane
        // kontaktowe przed zbieraniem, ale i rachunek.
        const rate = await checkRateLimit({
            key: `search_ip:${getClientIp(request)}`,
            max: SEARCH_RATE_LIMIT.maxRequestsPerIp,
            windowSeconds: SEARCH_RATE_LIMIT.windowSeconds,
        });

        if (!rate.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: 'RATE_LIMITED', message: 'Too many search requests' },
                    retryAfter: rate.retryAfter,
                },
                { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
            );
        }

        const parsed = searchQuerySchema.safeParse({
            query: searchParams.get('query'),
            category: searchParams.get('category'),
            voivodeship: searchParams.get('voivodeship'),
            locale: emptyToUndefined(searchParams.get('locale')),
            limit: emptyToUndefined(searchParams.get('limit')),
            excludeIds: searchParams.get('excludeIds'),
        });

        if (!parsed.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BAD_REQUEST',
                        message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
                    },
                },
                { status: 400 },
            );
        }

        const { query, category, voivodeship, locale, limit } = parsed.data;
        const excludeIdsParam = parsed.data.excludeIds;

        const excludeIds: string[] = excludeIdsParam
            ? excludeIdsParam
                  .split(',')
                  .map(id => id.trim())
                  .filter(Boolean)
            : [];

        // Obecnosc OPENAI_API_KEY gwarantuje walidacja Zod w env.ts przy starcie —
        // osobny guard w handlerze bylby martwym kodem.

        const startTime = Date.now();

        const { services, contextualQuery } = await searchServicesSemantic({
            query,
            category,
            voivodeship,
            locale,
            limit,
            excludeIds,
        });

        // `executionTime` wraca w odpowiedzi (nizej), wiec liczymy je nadal.
        const executionTime = Date.now() - startTime;

        // Wyniki punktowe sluza tylko do odsiania i ustawienia kolejnosci — na zewnatrz
        // nie wychodza. Podkreslenie w nazwie, bo to celowo odrzucone pola.
        const finalServices = services.map(
            ({ relevanceScore: _score, boostedScore: _boosted, ...service }) => service,
        );

        return NextResponse.json({
            success: true,
            services: finalServices,
            query,
            contextualQuery,
            locale,
            excludedIds: excludeIds,
            filters: {
                category,
                voivodeship,
            },
            count: finalServices.length,
            executionTime,
            relevanceThreshold: RELEVANCE_FLOOR,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Embedding search API error:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Embedding search failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
