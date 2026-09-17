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
 * KAZDA zmiana tresci ponizej wymaga przeliczenia wszystkiego przez
 * `npm run db:embeddings -- --force` — inaczej stare dokumenty i nowe zapytania
 * opisuja kategorie innymi slowami.
 *
 * Kazdy kontekst jest **czterojezyczny** (en/pl/uk/ru) i to nie jest ozdoba.
 * Katalog obsluguje uzytkownikow piszacych po polsku i ukrainsku, a dokumenty
 * opisywaly kategorie wylacznie po angielsku. Pomiar na 22 zapytaniach z
 * oczekiwana kategoria pokazal, gdzie to bolalo: "перукар" nie zwracalo NICZEGO,
 * "стоматолог" trafialo w warsztat samochodowy, a "fryzjer" w sklep spozywczy.
 * Zapytania jednowyrazowe w jezyku innym niz jezyk dokumentu maja za maly
 * zaczep, zeby model je polaczyl.
 *
 * `Record<Category, string>` zamiast `Record<string, string>` pilnuje kompletnosci:
 * nowa wartosc w `categoryEnum` nie skompiluje sie bez dopisania kontekstu.
 */
export const CATEGORY_CONTEXTS: Record<Category, string> = {
    transport:
        'transportation, travel, vehicles, logistics, shipping, delivery, public transport, taxi, rideshare; transport, przeprowadzki, przewóz osób, kurier, dostawa, spedycja, taksówka; перевезення, переїзд, кур’єр, доставка, таксі, вантажі; перевозки, переезд, курьер, доставка, такси',
    health:
        'healthcare, medical, wellness, fitness, pharmacy, therapy, mental health, dental; lekarz, przychodnia, dentysta, stomatolog, fizjoterapia, psycholog, apteka, badania; лікар, клініка, стоматолог, зубний лікар, фізіотерапія, психолог, аптека; врач, клиника, стоматолог, зубной врач, психолог, аптека',
    beauty:
        'beauty, cosmetics, skincare, haircare, hairdresser, spa, wellness, aesthetics, grooming; fryzjer, fryzjerka, salon fryzjerski, strzyżenie, paznokcie, manicure, pedicure, kosmetyczka, brwi, rzęsy, barber, makijaż; перукар, перукарня, стрижка, манікюр, педикюр, косметолог, брови, вії, барбер, макіяж; парикмахер, парикмахерская, стрижка, маникюр, педикюр, косметолог, брови, ресницы',
    education:
        'education, learning, training, courses, schools, tutoring, skills development; szkoła językowa, kurs polskiego, korepetycje, nauka, przedszkole, żłobek, szkolenia; мовна школа, курси польської, репетитор, навчання, садочок, тренінги; языковая школа, курсы польского, репетитор, обучение, детский сад',
    financial:
        'finance, banking, insurance, investment, accounting, loans, financial planning; księgowość, księgowa, biuro rachunkowe, podatki, PIT, ubezpieczenia, kredyt, rozliczenia; бухгалтерія, бухгалтер, податки, страхування, кредит, декларація; бухгалтерия, бухгалтер, налоги, страхование, кредит',
    law:
        'legal services, lawyers, attorneys, legal advice, court, litigation, contracts; prawnik, adwokat, radca prawny, kancelaria, legalizacja pobytu, karta pobytu, obywatelstwo, tłumacz przysięgły; юрист, адвокат, юридична консультація, легалізація перебування, карта побиту, громадянство, присяжний перекладач; юрист, адвокат, легализация, карта побыта, гражданство, присяжный переводчик',
    mechanics:
        'automotive repair, machinery, technical services, maintenance, engineering; mechanik, warsztat samochodowy, naprawa auta, wulkanizacja, wymiana opon, blacharstwo, lakiernictwo, serwis; механік, автосервіс, СТО, ремонт авто, шиномонтаж, заміна шин, кузовний ремонт; механик, автосервис, СТО, ремонт авто, шиномонтаж, кузовной ремонт',
    renovation:
        'construction, home improvement, building, repair, maintenance, contractors; remont, wykończenia, hydraulik, elektryk, malowanie, płytki, gładzie, ekipa remontowa; ремонт, оздоблення, сантехнік, електрик, малярні роботи, плитка, ремонтна бригада; ремонт, отделка, сантехник, электрик, покраска, плитка',
    grocery:
        'grocery, supermarket, food shopping, retail, convenience store, market; sklep spożywczy, market, delikatesy, produkty, zakupy, sklep osiedlowy; продуктовий магазин, супермаркет, продукти, покупки, делікатеси; продуктовый магазин, супермаркет, продукты, покупки',
    gastronomy:
        'food, restaurant, dining, cuisine, catering, beverages, cooking, nutrition; restauracja, kawiarnia, jedzenie na wynos, obiady, catering, bar, piekarnia; ресторан, кафе, їжа на виніс, обіди, кейтеринг, бар, пекарня; ресторан, кафе, еда навынос, обеды, кейтеринг, бар',
    real_estate:
        'real estate, property, housing, apartments, rental, buying, selling, mortgage; nieruchomości, wynajem mieszkania, mieszkanie, pośrednik, agencja nieruchomości, kupno, sprzedaż; нерухомість, оренда квартири, квартира, ріелтор, агентство нерухомості; недвижимость, аренда квартиры, квартира, риелтор, агентство недвижимости',
    help_support:
        'help, support, assistance, aid, charity, social services, counseling; pomoc, wsparcie, fundacja, organizacja pozarządowa, uchodźcy, pomoc socjalna, doradztwo, integracja; допомога, підтримка, фонд, громадська організація, біженці, соціальна допомога, консультація; помощь, поддержка, фонд, беженцы, социальная помощь, консультация',
    it:
        'it, computers, software, website, web development, web design, seo, online store, e-commerce, hosting, ai, automation, computer repair, laptop repair, programming; informatyka, strony internetowe, sklep internetowy, pozycjonowanie, hosting, naprawa komputerów, programista, aplikacje; сайти, розробка сайтів, інтернет-магазин, хостинг, ремонт комп’ютерів, програміст, застосунки; сайты, разработка сайтов, интернет-магазин, хостинг, ремонт компьютеров, программист',
    others: 'general services, miscellaneous, various; usługi, różne, inne; послуги, різне, інше; услуги, разное, прочее',
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
