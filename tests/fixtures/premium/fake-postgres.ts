/**
 * Atrapa sterownika `postgres` (baza to zewnetrzny serwis) dla testow adapterow Drizzle:
 * prawdziwy `drizzle({ client })` buduje i wysyla SQL, a atrapa zapisuje kazde zapytanie
 * (z informacja, czy padlo w transakcji) zamiast laczyc sie z baza. Kazde zapytanie
 * zwraca pusty wynik — wystarcza dla zapisow bez `returning`.
 *
 *   jest.mock('postgres', () =>
 *       jest.requireActual('<sciezka>/fake-postgres').fakePostgresModule);
 */

export interface RecordedStatement {
    sql: string;
    params: unknown[];
    isInTransaction: boolean;
}

export const fakePostgres: { statements: RecordedStatement[]; transactions: number } = {
    statements: [],
    transactions: 0,
};

export function resetFakePostgres(): void {
    fakePostgres.statements = [];
    fakePostgres.transactions = 0;
}

interface FakeClient {
    /** Drizzle wpisuje tu wlasne parsery dat przy tworzeniu klienta. */
    options: { parsers: Record<string, unknown>; serializers: Record<string, unknown> };
    unsafe(sql: string, params: unknown[]): Promise<unknown[]>;
    begin<T>(work: (client: FakeClient) => Promise<T>): Promise<T>;
}

function createClient(isInTransaction: boolean): FakeClient {
    return {
        options: { parsers: {}, serializers: {} },
        unsafe: async (sql, params) => {
            fakePostgres.statements.push({ sql, params, isInTransaction });
            return [];
        },
        begin: async work => {
            fakePostgres.transactions += 1;
            return work(createClient(true));
        },
    };
}

export const fakePostgresModule = {
    __esModule: true,
    default: (): FakeClient => createClient(false),
};
