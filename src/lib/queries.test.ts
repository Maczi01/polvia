/**
 * @jest-environment node
 */
// jsdom nie ma `URL.canParse` (uzywa go `pickByHost`).
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { findServiceByDomain } from './queries';

interface CandidateRow {
    name: string;
    slug: string;
    webpage: string | null;
}

/** Co trafilo do bazy: warunek `WHERE` i `LIMIT`. Baza to zewnetrzny serwis. */
const mockQuery: { where: SQL | undefined; limit: number | undefined; rows: CandidateRow[] } = {
    where: undefined,
    limit: undefined,
    rows: [],
};

/** Fluent API Drizzle w zakresie `findServiceByDomain`; `limit` honoruje jak Postgres. */
jest.mock('@/db', () => {
    const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (condition: SQL | undefined) => {
            mockQuery.where = condition;
            return chain;
        },
        orderBy: () => chain,
        limit: async (count: number) => {
            mockQuery.limit = count;
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
    mockQuery.rows = [];
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
