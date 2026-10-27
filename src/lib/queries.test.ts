/**
 * @jest-environment node
 */
// jsdom nie ma `URL.canParse` (uzywa go `pickByHost`).
import { PgDialect } from 'drizzle-orm/pg-core';
import { is, SQL } from 'drizzle-orm';

import { findServiceByDomain, getHomepageServices, type HomepageService } from './queries';

interface CandidateRow {
    name: string;
    slug: string;
    webpage: string | null;
}

/** Co trafilo do bazy: `WHERE`, `ORDER BY` i `LIMIT`. Baza to zewnetrzny serwis. */
const mockQuery: {
    where: SQL | undefined;
    limit: number | undefined;
    orderBy: unknown[][];
    limits: number[];
    rows: unknown[];
    failure: Error | undefined;
} = {
    where: undefined,
    limit: undefined,
    orderBy: [],
    limits: [],
    rows: [],
    failure: undefined,
};

/** Fluent API Drizzle w zakresie testowanych query; `limit` honoruje jak Postgres. */
jest.mock('@/db', () => {
    const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (condition: SQL | undefined) => {
            mockQuery.where = condition;
            return chain;
        },
        $dynamic: () => chain,
        orderBy: (...columns: unknown[]) => {
            mockQuery.orderBy.push(columns);
            return chain;
        },
        limit: async (count: number) => {
            if (mockQuery.failure) throw mockQuery.failure;
            mockQuery.limit = count;
            mockQuery.limits.push(count);
            return mockQuery.rows.slice(0, count);
        },
    };
    return { db: { select: () => chain } };
});

function renderedWhere(): { sql: string; params: unknown[] } {
    if (!mockQuery.where) throw new Error('findServiceByDomain nie zbudowalo WHERE');
    return new PgDialect().sqlToQuery(mockQuery.where);
}

function candidate(index: number, webpage: string): CandidateRow {
    return { name: `Firma ${index}`, slug: `firma-${index}`, webpage };
}

beforeEach(() => {
    mockQuery.where = undefined;
    mockQuery.limit = undefined;
    mockQuery.orderBy = [];
    mockQuery.limits = [];
    mockQuery.rows = [];
    mockQuery.failure = undefined;
});

describe('findServiceByDomain', () => {
    it('ponad 20 kolizji prefiksu nie wypycha prawdziwego duplikatu', async () => {
        const collisions = Array.from({ length: 25 }, (_, index) =>
            candidate(index, `https://art.pl.mirror-${index}.com`),
        );
        mockQuery.rows = [...collisions, candidate(99, 'https://www.art.pl/kontakt')];

        const match = await findServiceByDomain('art.pl', 'pl');

        expect(match).toEqual({ name: 'Firma 99', slug: 'firma-99' });
    });

    it('wysyla zakotwiczone wzorce jako parametry, nie %host%', async () => {
        await findServiceByDomain('art.pl', 'pl');

        const { params } = renderedWhere();
        expect(params).toEqual(
            expect.arrayContaining(['%://art.pl%', '%://www.art.pl%', 'art.pl%', 'www.art.pl%']),
        );
        expect(params).not.toContain('%art.pl%');
    });

    it('normalizuje host z www. i wielkimi literami przed zapytaniem', async () => {
        mockQuery.rows = [candidate(1, 'https://art.pl')];

        const match = await findServiceByDomain('WWW.Art.PL', 'pl');

        expect(match?.slug).toBe('firma-1');
        expect(renderedWhere().params).toEqual(expect.arrayContaining(['%://art.pl%']));
    });

    it('escapuje znaki specjalne LIKE w hoscie', async () => {
        await findServiceByDomain('a_b.pl', 'pl');

        expect(renderedWhere().params).toEqual(expect.arrayContaining([String.raw`a\_b.pl%`]));
    });

    it('sam prefiks hosta nie jest duplikatem', async () => {
        mockQuery.rows = [candidate(1, 'https://art.pl.example.com')];

        expect(await findServiceByDomain('art.pl', 'pl')).toBeNull();
    });

    it('pusty host zwraca null bez zapytania do bazy', async () => {
        expect(await findServiceByDomain('www.', 'pl')).toBeNull();
        expect(mockQuery.where).toBeUndefined();
    });
});

describe('getHomepageServices', () => {
    const SERVICE: HomepageService = {
        serviceId: 'id-1',
        slug: 'best-market-warszawa',
        name: 'Best Market',
        category: 'grocery',
        image: null,
    };

    /** Pierwsza kolumna `ORDER BY` danego zapytania (0 = popularne, 1 = najnowsze). */
    function renderedOrder(query: number): string {
        const [first] = mockQuery.orderBy[query] ?? [];
        if (!is(first, SQL)) throw new Error(`zapytanie ${query} nie ma ORDER BY w SQL`);
        return new PgDialect().sqlToQuery(first).sql;
    }

    it('zwraca obie listy, kazda ograniczona do 5 firm', async () => {
        mockQuery.rows = Array.from({ length: 8 }, () => SERVICE);

        const { popular, newest } = await getHomepageServices('pl');

        expect(popular).toHaveLength(5);
        expect(newest).toHaveLength(5);
        expect(mockQuery.limits).toEqual([5, 5]);
    });

    it('popularnosc sumuje klikniecia per firma, a nie per lokalizacja', async () => {
        await getHomepageServices('pl');

        const order = renderedOrder(0);
        expect(order).toContain('SUM("service_engagements"."clicks")');
        expect(order).toContain('desc');
    });

    it('ostatnio dodane sortuje po dacie dodania firmy, malejaco', async () => {
        await getHomepageServices('pl');

        expect(renderedOrder(1)).toBe('"services"."created_at" desc');
    });

    it('pomija firmy bez zadnej lokalizacji (karta nie mialaby linku)', async () => {
        await getHomepageServices('pl');

        if (!mockQuery.where) throw new Error('getHomepageServices nie zbudowalo WHERE');
        const { sql } = new PgDialect().sqlToQuery(mockQuery.where);
        expect(sql).toMatch(/EXISTS \(\s*SELECT 1 FROM "service_locations"/);
    });

    it('blad bazy przechodzi do wolajacego', async () => {
        mockQuery.failure = new Error('connection refused');

        await expect(getHomepageServices('pl')).rejects.toThrow('connection refused');
    });
});
