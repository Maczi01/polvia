import { categoryEnum } from '@/db/schema';

export type Category = (typeof categoryEnum.enumValues)[number];

/**
 * Kontekst semantyczny kategorii — dopisywany do tekstu dokumentu przy generowaniu
 * embeddingu (`src/db/generate-embeddings.ts`) oraz do zapytania uzytkownika, gdy
 * ma ono filtr kategorii (`src/app/api/services/route.ts`).
 *
 * Jedno zrodlo prawdy dla obu stron celowo. Wczesniej kazdy modul mial wlasna kopie
 * i kopie sie rozjechaly: wersja z route'a nie znala `gastronomy` (zapytanie o
 * restauracje nie dostawalo zadnego kontekstu) i miala `government`, ktorego nie ma
 * w `categoryEnum`. Opis kategorii po stronie dokumentu i po stronie zapytania musi
 * byc ten sam — inaczej obie strony opisuja to samo innymi slowami.
 *
 * Wartosci sa przepisane z `generate-embeddings.ts` co do znaku, bo to one siedza
 * w juz policzonych embeddingach. KAZDA zmiana tresci ponizej wymaga przeliczenia
 * wszystkiego przez `npm run db:embeddings`.
 *
 * `Record<Category, string>` zamiast `Record<string, string>` pilnuje kompletnosci:
 * nowa wartosc w `categoryEnum` nie skompiluje sie bez dopisania kontekstu.
 */
export const CATEGORY_CONTEXTS: Record<Category, string> = {
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
    it: 'it, computers, software, website, web development, web design, seo, online store, e-commerce, hosting, ai, automation, computer repair, laptop repair, programming',
    others: 'general services, miscellaneous, various',
};

/**
 * `Set` z wartosci enuma, a nie `value in CATEGORY_CONTEXTS`: `in` widzi takze
 * prototyp, wiec `isCategory('toString')` zwracaloby `true` i wpuszczalo smiec
 * do zapytania i do filtra SQL.
 */
const CATEGORIES: ReadonlySet<string> = new Set<string>(categoryEnum.enumValues);

export function isCategory(value: string | null | undefined): value is Category {
    return value !== null && value !== undefined && CATEGORIES.has(value);
}

/**
 * Wzbogaca zapytanie uzytkownika o kontekst wybranej kategorii. Bez kategorii
 * (albo z kategoria spoza enuma) zapytanie idzie do modelu nietkniete.
 */
export function createContextualQuery(query: string, category: string | null | undefined): string {
    if (!isCategory(category)) {
        return query;
    }

    return `${query} in the context of ${category}: ${CATEGORY_CONTEXTS[category]}`;
}
