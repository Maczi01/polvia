import { db } from '@/db';
import { getServices } from '@/lib/queries';
import { splitServicesByCoverage } from '@/lib/service-coverage';

/**
 * Diagnostyka: jaki odsetek naturalnych zapytan znajduje cokolwiek leksykalnie.
 *
 * WYLACZNIE ODCZYT. Liczy wyniki przez produkcyjna sciezke (`getServices` +
 * `splitServicesByCoverage`), bez wlasnego dopasowywania — inaczej mierzylibysmy
 * kopie zamiast aplikacji. Wyniki semantyczne (embeddingi) NIE sa liczone.
 *
 * Liczby zaleza od zywych danych — to NIE jest test i nie wolno ich zamrazac w bramce.
 *
 * Uruchomienie: `npm run db:measure-search`
 */

const LOCALE = 'pl';

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

async function measureSearchCoverage(): Promise<void> {
    const services = await getServices(LOCALE);

    const rows = QUERIES.map(query => {
        const { localResults, onlineResults } = splitServicesByCoverage(services, { query });
        return { query, results: localResults.length + onlineResults.length };
    });

    const zeroCount = rows.filter(row => row.results === 0).length;
    const zeroPercent = ((zeroCount / rows.length) * 100).toFixed(1);

    console.log(`Lokalizacje w katalogu (${LOCALE}): ${services.length}\n`);
    console.table(rows);
    console.log(`\nZapytania bez wynikow: ${zeroCount}/${rows.length} (${zeroPercent}%)`);
}

// Pakiet jest CJS (brak "type": "module"), wiec tsx nie przepusci top-level await.
// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('Pomiar nie powiodl sie:', error);
    process.exitCode = 1;
});
