/**
 * Atrapa bazy (`@/db`) dla testow `service-profile-queries*.test.ts`: fluent API Drizzle
 * w zakresie testowanych query. N-te `select()` dostaje `fakeProfileDb.results[n]`.
 * Zapytanie bez `limit` jest awaitowane wprost po `where`/`orderBy` (jak w `queries.test.ts`);
 * `limit` honoruje jak Postgres. Baza to zewnetrzny serwis — zapytania budowane sa prawdziwie.
 *
 *   jest.mock('@/db', () => jest.requireActual('<sciezka>/fake-profile-db').fakeProfileDbModule);
 */
import { Column, is, SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { ServiceProfileLocation } from '@/lib/service-profile-queries';

/** Jedno zapytanie zbudowane na atrapie: co wybralo, z jakim WHERE/JOIN i LIMIT. */
export interface RecordedQuery {
    selected: Record<string, unknown>;
    joins: unknown[];
    where: unknown;
    orderBy: unknown[];
    limit: number | undefined;
}

export const fakeProfileDb: {
    queries: RecordedQuery[];
    results: unknown[][];
    failure: Error | undefined;
} = {
    queries: [],
    results: [],
    failure: undefined,
};

export function resetFakeProfileDb(): void {
    fakeProfileDb.queries = [];
    fakeProfileDb.results = [];
    fakeProfileDb.failure = undefined;
}

function createQuery(selected: Record<string, unknown>) {
    const index = fakeProfileDb.queries.length;
    const record: RecordedQuery = {
        selected,
        joins: [],
        where: undefined,
        orderBy: [],
        limit: undefined,
    };
    fakeProfileDb.queries.push(record);

    // Wynik liczony po zbudowaniu calego lancucha (mikrozadanie), wiec widzi juz `limit`.
    const awaitable = () =>
        Object.assign(
            Promise.resolve().then(() => fakeProfileDb.results[index] ?? []),
            query,
        );

    const query = {
        from: () => query,
        leftJoin: (_table: unknown, condition: unknown) => {
            record.joins.push(condition);
            return query;
        },
        innerJoin: (_table: unknown, condition: unknown) => {
            record.joins.push(condition);
            return query;
        },
        where: (condition: unknown) => {
            record.where = condition;
            return awaitable();
        },
        orderBy: (...terms: unknown[]) => {
            record.orderBy = terms;
            return awaitable();
        },
        limit: async (count: number) => {
            if (fakeProfileDb.failure) throw fakeProfileDb.failure;
            record.limit = count;
            return (fakeProfileDb.results[index] ?? []).slice(0, count);
        },
    };
    return query;
}

export const fakeProfileDbModule = {
    db: { select: (fields: Record<string, unknown> = {}) => createQuery(fields) },
};

export function render(condition: unknown): { sql: string; params: unknown[] } {
    if (is(condition, SQL)) return new PgDialect().sqlToQuery(condition);
    // Kolumna Drizzle (np. `servicesTable.id` w `orderBy`) — renderujemy przez `sql`.
    if (is(condition, Column)) return new PgDialect().sqlToQuery(sql`${condition}`);
    throw new Error('oczekiwano wyrazenia SQL albo kolumny');
}

export function query(index: number): RecordedQuery {
    const recorded = fakeProfileDb.queries[index];
    if (!recorded) throw new Error(`brak zapytania nr ${index}`);
    return recorded;
}

export const SERVICE_ROW = {
    id: 'svc-1',
    name: 'Юридична фірма Роза',
    description: 'Опис українською',
    category: 'legal',
    coverage: 'local',
    languages: ['pl', 'uk'],
    verified: true,
    image: 'roza.png',
    tags: ['Податки'],
    subscription: null,
    manualPremiumUntil: null,
};

export function location(overrides: Partial<ServiceProfileLocation> = {}): ServiceProfileLocation {
    return {
        id: 'loc-1',
        slug: 'roza-warszawa',
        city: 'Warszawa',
        street: 'Marszałkowska 1',
        voivodeship: 'mazowieckie',
        postcode: '00-001',
        latitude: 52.23,
        longitude: 21.01,
        openingHours: { monday: { open: '09:00', close: '17:00' } },
        phoneNumber: '+48 600 000 000',
        email: 'biuro@roza.pl',
        webpage: 'https://roza.pl',
        socials: { telegram: 'https://t.me/roza' },
        whatsappNumber: '+48600000000',
        isMainLocation: true,
        ...overrides,
    };
}
