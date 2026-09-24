import { db } from '@/db';
import { getServices } from '@/lib/queries';
import {
    DEFAULT_SEMANTIC_LIMIT,
    type SemanticMatch,
    searchServicesSemantic,
} from '@/lib/semantic-search';
import { shouldRunSemanticSearch } from '@/lib/semantic-search-trigger';
import { splitServicesByCoverage } from '@/lib/service-coverage';
import type { PartialService } from '@/types';

/**
 * Diagnostyka: jaki odsetek naturalnych zapytan znajduje cokolwiek na ekranie mapy.
 *
 * WYLACZNIE ODCZYT z bazy. Liczy wyniki przez produkcyjna sciezke, bez wlasnego
 * dopasowywania — inaczej mierzylibysmy kopie zamiast aplikacji:
 * - tekstowe: `getServices` + `splitServicesByCoverage`,
 * - semantyczne: `searchServicesSemantic` (to samo co `/api/services`), odpalane tylko
 *   wtedy, gdy `shouldRunSemanticSearch` odpala je w UI.
 *
 * Kazde odpalone wyszukiwanie semantyczne to jeden platny embedding w OpenAI.
 * Blad OpenAI przerywa pomiar — UI w tej sytuacji cicho pokazuje zero wynikow
 * semantycznych, a pomiar policzylby to jako prawdziwy brak dopasowan.
 *
 * Liczby zaleza od zywych danych — to NIE jest test i nie wolno ich zamrazac w bramce.
 *
 * Uruchomienie: `npm run db:measure-search`
 */

const LOCALE = 'pl';

/** Pomiar bez oceny trafnosci liczylby stary ranking i wygladal na poprawny. */
class RelevanceCheckUnavailableError extends Error {
    constructor(query: string) {
        super(`Ocena trafnosci niedostepna dla zapytania "${query}" — pomiar przerwany`);
        this.name = 'RelevanceCheckUnavailableError';
    }
}

// Zestaw odniesienia z pomiaru 2026-09-22. Pary z diakrytykami i bez sa celowe —
// obnazaja wrazliwosc na diakrytyki. Nie redukowac do jednej formy.
const QUERIES = [
    'fryzjer',
    'prawnik',
    'adwokat',
    'ksiegowa',
    'księgowa',
    'lekarz',
    'dentysta',
    'sklep',
    'restauracja',
    'mechanik',
    'tlumacz',
    'tłumacz',
    'remont',
    'nieruchomosci',
    'praca',
    'ubezpieczenie',
    'przedszkole',
    'kurs polskiego',
    'taxi',
    'kurier',
    'paznokcie',
    'pizza',
    'samochod',
    'samochód',
    'wiza',
    'pesel',
    'meldunek',
    'kredyt',
    'bank',
    'apteka',
    'masaz',
    'masaż',
    'budowa',
    'sprzatanie',
    'sprzątanie',
    'pralnia',
    'weterynarz',
    'notariusz',
    'psycholog',
    'szkola jazdy',
];

async function main(): Promise<void> {
    try {
        await measureSearchCoverage();
    } finally {
        await db.$client.end();
    }
}

type QueryMeasurement = {
    query: string;
    /** Lista lokalna + sekcja online, bez embeddingow. */
    lexical: number;
    /** `null` = UI nie odpala wyszukiwania semantycznego dla tego zapytania. */
    semantic: SemanticMatch[] | null;
    /** Wszystko, co ekran pokazuje: tak jak `filteredServices` w komponencie mapy. */
    total: number;
};

/** Odtwarza przebieg ekranu mapy bez filtrow w URL-u, krok po kroku jak komponent. */
async function measureQuery(services: PartialService[], query: string): Promise<QueryMeasurement> {
    const lexical = splitServicesByCoverage(services, { query });
    const lexicalCount = lexical.localResults.length + lexical.onlineResults.length;

    const isSemanticTriggered = shouldRunSemanticSearch({
        query,
        localResultsCount: lexical.localResults.length,
    });
    if (!isSemanticTriggered) {
        return { query, lexical: lexicalCount, semantic: null, total: lexicalCount };
    }

    // Bez filtrow w URL-u zawezenie `filteredEmbeddingResults` w komponencie niczego nie odsiewa.
    const { services: semanticResults, relevanceCheck } = await searchServicesSemantic({
        query: query.trim(),
        locale: LOCALE,
        limit: DEFAULT_SEMANTIC_LIMIT,
        excludeIds: lexical.localResults.map(service => service.serviceId),
    });
    if (relevanceCheck === 'unavailable') throw new RelevanceCheckUnavailableError(query);

    // Sekcja online odejmuje wyniki semantyczne — drugie wywolanie, jak w komponencie.
    const { onlineResults } = splitServicesByCoverage(services, { query }, semanticResults);
    const total = lexical.localResults.length + onlineResults.length + semanticResults.length;

    return { query, lexical: lexicalCount, semantic: semanticResults, total };
}

/**
 * Wyniki semantyczne przeszly ocene modelu (`semantic-relevance-judge`), ale model tez
 * sie myli. Nazwy i podobienstwo sa po to, zeby kazdy wiersz "razem" dalo sie
 * sprawdzic okiem, zanim uzna sie go za sukces.
 */
function printSemanticResults(rows: QueryMeasurement[]): void {
    console.log('\nWyniki semantyczne do oceny trafnosci:');
    for (const { query, semantic } of rows) {
        if (semantic === null) continue;
        const names = semantic.map(
            service => `${service.name} [${service.category}] ${service.relevanceScore.toFixed(3)}`,
        );
        console.log(`  ${query}: ${names.length > 0 ? names.join(' | ') : '(brak)'}`);
    }
}

function formatShare(count: number, all: number): string {
    return `${count}/${all} (${((count / all) * 100).toFixed(1)}%)`;
}

async function measureSearchCoverage(): Promise<void> {
    const services = await getServices(LOCALE);

    // Po kolei, nie rownolegle: kolejnosc wywolan OpenAI jest wtedy powtarzalna,
    // a 40 zapytan i tak konczy sie w kilkanascie sekund.
    const rows: QueryMeasurement[] = [];
    for (const query of QUERIES) {
        rows.push(await measureQuery(services, query));
    }

    const lexicalZero = rows.filter(row => row.lexical === 0).length;
    const totalZero = rows.filter(row => row.total === 0).length;
    const semanticCalls = rows.filter(row => row.semantic !== null).length;

    console.log(`Lokalizacje w katalogu (${LOCALE}): ${services.length}\n`);
    console.table(
        rows.map(row => ({
            zapytanie: row.query,
            tekstowe: row.lexical,
            semantyczne: row.semantic?.length ?? '—',
            razem: row.total,
        })),
    );
    printSemanticResults(rows);
    console.log(`\nWyszukiwan semantycznych (embeddingow OpenAI): ${semanticCalls}`);
    console.log(`Bez wynikow tekstowych: ${formatShare(lexicalZero, rows.length)}`);
    console.log(`Bez wynikow na ekranie: ${formatShare(totalZero, rows.length)}`);
    console.log('Wyniki semantyczne ocenione przez model — sprawdz liste powyzej.');
}

// Pakiet jest CJS (brak "type": "module"), wiec tsx nie przepusci top-level await.
// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('Pomiar nie powiodl sie:', error);
    process.exitCode = 1;
});
