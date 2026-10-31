/**
 * @jest-environment node
 */
import { Column, is, SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { db } from '@/db';

import {
    getServiceProfile,
    getServiceProfileSitemapEntries,
    getServiceSlugStatus,
    getSimilarServices,
    type ServiceProfileLocation,
} from './service-profile-queries';
import { SIMILAR_SERVICES_LIMIT, type SimilarServicesSource } from './similar-services';

/** Jedno zapytanie zbudowane na mocku: co wybralo, z jakim WHERE/JOIN i LIMIT. */
interface RecordedQuery {
    selected: Record<string, unknown>;
    joins: unknown[];
    where: unknown;
    orderBy: unknown[];
    limit: number | undefined;
}

/**
 * Baza to zewnetrzny serwis. Fluent API Drizzle w zakresie testowanych query:
 * n-te `select()` dostaje `results[n]`. Zapytanie bez `limit` jest awaitowane
 * wprost po `where`/`orderBy` (jak w `queries.test.ts`); `limit` honoruje jak Postgres.
 */
const mockDb: { queries: RecordedQuery[]; results: unknown[][]; failure: Error | undefined } = {
    queries: [],
    results: [],
    failure: undefined,
};

jest.mock('@/db', () => {
    function createQuery(selected: Record<string, unknown>) {
        const index = mockDb.queries.length;
        const record: RecordedQuery = {
            selected,
            joins: [],
            where: undefined,
            orderBy: [],
            limit: undefined,
        };
        mockDb.queries.push(record);

        // Wynik liczony po zbudowaniu calego lancucha (mikrozadanie), wiec widzi juz `limit`.
        const awaitable = () =>
            Object.assign(
                Promise.resolve().then(() => mockDb.results[index] ?? []),
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
                if (mockDb.failure) throw mockDb.failure;
                record.limit = count;
                return (mockDb.results[index] ?? []).slice(0, count);
            },
        };
        return query;
    }

    return { db: { select: (fields: Record<string, unknown> = {}) => createQuery(fields) } };
});

function render(condition: unknown): { sql: string; params: unknown[] } {
    if (is(condition, SQL)) return new PgDialect().sqlToQuery(condition);
    // Kolumna Drizzle (np. `servicesTable.id` w `orderBy`) — renderujemy przez `sql`.
    if (is(condition, Column)) return new PgDialect().sqlToQuery(sql`${condition}`);
    throw new Error('oczekiwano wyrazenia SQL albo kolumny');
}

function query(index: number): RecordedQuery {
    const recorded = mockDb.queries[index];
    if (!recorded) throw new Error(`brak zapytania nr ${index}`);
    return recorded;
}

const SERVICE_ROW = {
    id: 'svc-1',
    name: 'Юридична фірма Роза',
    description: 'Опис українською',
    category: 'legal',
    coverage: 'local',
    languages: ['pl', 'uk'],
    verified: true,
    image: 'roza.png',
    tags: ['Податки'],
};

function location(overrides: Partial<ServiceProfileLocation> = {}): ServiceProfileLocation {
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

beforeEach(() => {
    mockDb.queries = [];
    mockDb.results = [];
    mockDb.failure = undefined;
});

describe('getServiceProfile', () => {
    it('zwraca nazwe i opis z tlumaczenia uk razem z lokalizacjami', async () => {
        mockDb.results = [[SERVICE_ROW], [location()]];

        const profile = await getServiceProfile('roza', 'uk');

        expect(profile).toEqual({ ...SERVICE_ROW, slug: 'roza', locations: [location()] });
        expect(render(query(0).joins[0]).params).toContain('uk');
    });

    it('lokalizacje pobiera rownolegle, po slugu aktywnego wpisu (nie po id z pierwszego zapytania)', async () => {
        mockDb.results = [[SERVICE_ROW], [location()]];

        await getServiceProfile('roza', 'uk');

        expect(mockDb.queries).toHaveLength(2);
        expect(render(query(1).where).params).toEqual(['roza', 'active']);
    });

    it('przy braku tlumaczenia bierze services.name (COALESCE)', async () => {
        mockDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'uk');

        const name = render(query(0).selected.name).sql;
        expect(name).toMatch(/^COALESCE\(.*"name", "services"\."name"\)$/);
    });

    it('szuka po slugu wsrod aktywnych wpisow, a brak aktywnego daje null', async () => {
        mockDb.results = [[]];

        const profile = await getServiceProfile('roza', 'pl');

        expect(profile).toBeNull();
        const where = render(query(0).where);
        expect(where.sql).toContain('"services"."slug" = $1');
        expect(where.sql).toContain('"services"."status" = $2');
        expect(where.params).toEqual(['roza', 'active']);
    });

    it('wpis online-only zwraca lokalizacje bez wspolrzednych bez bledu', async () => {
        const online = location({ latitude: null, longitude: null, street: null });
        mockDb.results = [[{ ...SERVICE_ROW, coverage: 'online' }], [online]];

        const profile = await getServiceProfile('roza', 'pl');

        expect(profile?.locations).toEqual([online]);
        expect(profile?.locations[0]?.latitude).toBeNull();
    });

    it('tagi w locale profilu, z pusta tablica zamiast NULL', async () => {
        mockDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'ru');

        const tags = render(query(0).selected.tags);
        expect(tags.sql).toContain('ARRAY[]::text[]');
        expect(tags.params).toEqual(['ru']);
    });

    it('blad bazy przechodzi do wolajacego', async () => {
        mockDb.failure = new Error('connection refused');

        await expect(getServiceProfile('roza', 'pl')).rejects.toThrow('connection refused');
    });
});

describe('getSimilarServices', () => {
    const SOURCE: SimilarServicesSource = { serviceId: 'svc-1', category: 'law', city: ' Warszawa ' };

    function candidate(id: string, slug: string | null = id) {
        return { serviceId: id, slug, name: `Firma ${id}`, image: null, city: 'Warszawa', category: 'law' };
    }

    it('jedno zapytanie z limitem w SQL, bez ponownego pobierania kategorii i miasta zrodla', async () => {
        mockDb.results = [[candidate('a'), candidate('b')]];

        const similar = await getSimilarServices(SOURCE, 'pl');

        expect(similar.map(item => item.serviceId)).toEqual(['a', 'b']);
        expect(mockDb.queries).toHaveLength(1);
        expect(query(0).limit).toBe(SIMILAR_SERVICES_LIMIT);
    });

    it('filtruje w SQL: aktywne, ta sama kategoria, bez wlasnego wpisu, ze slugiem', async () => {
        await getSimilarServices(SOURCE, 'uk');

        const where = render(query(0).where);
        expect(where.params).toEqual(['active', 'law', 'svc-1']);
        expect(where.sql).toContain('"services"."id" <> $3');
        expect(where.sql).toContain('"services"."slug" is not null');
        expect(render(query(0).joins[0]).params).toContain('uk');
    });

    it('sortuje najpierw po miescie zrodla (bez wielkosci liter i spacji), potem po nazwie', async () => {
        await getSimilarServices(SOURCE, 'pl');

        // Podzapytanie miasta ma znaki nowej linii — splaszczamy, zeby `.` w regexie je objal.
        const [sameCity, byName, tieBreaker] = query(0)
            .orderBy.map(render)
            .map(term => ({ ...term, sql: term.sql.replaceAll(/\s+/g, ' ') }));
        expect(sameCity?.sql).toMatch(/lower\(btrim\(.*"service_locations"\."city".*\)\) = lower\(\$\d+\)/);
        expect(sameCity?.sql).toMatch(/^COALESCE\(.*, false\) DESC$/);
        expect(sameCity?.params).toEqual(['Warszawa']);
        expect(byName?.sql).toContain('COALESCE');
        expect(tieBreaker?.sql).toBe('"services"."id"');
    });

    it.each([null, '', '   '])('zrodlo bez miasta (%p) nie promuje zadnego miasta', async city => {
        await getSimilarServices({ ...SOURCE, city }, 'pl');

        const sameCity = render(query(0).orderBy[0]);
        expect(sameCity.sql).toBe('false DESC');
        expect(sameCity.params).toEqual([]);
    });

    it('pomija kandydata bez slugu, nawet gdy baza go zwrocila', async () => {
        mockDb.results = [[candidate('a', null)]];

        expect(await getSimilarServices(SOURCE, 'pl')).toEqual([]);
    });

    it('blad bazy przechodzi do wolajacego', async () => {
        mockDb.failure = new Error('connection refused');

        await expect(getSimilarServices(SOURCE, 'pl')).rejects.toThrow('connection refused');
    });
});

describe('getServiceSlugStatus', () => {
    it('aktywny wpis pod slugiem istnieje', async () => {
        mockDb.results = [[{ id: 'svc-1' }]];

        expect(await getServiceSlugStatus('roza')).toEqual({ exists: true });
        expect(render(query(0).where).params).toEqual(['roza', 'active']);
        expect(query(0).limit).toBe(1);
    });

    it('brak aktywnego wpisu pod slugiem', async () => {
        mockDb.results = [[]];

        expect(await getServiceSlugStatus('nie-ma')).toEqual({ exists: false });
    });
});

describe('getServiceProfileSitemapEntries', () => {
    const UPDATED_AT = new Date('2026-10-30T12:00:00Z');

    it('zwraca slugi z data aktualizacji, filtrujac w SQL aktywne wpisy ze slugiem', async () => {
        mockDb.results = [[{ slug: 'roza', updatedAt: UPDATED_AT }]];

        expect(await getServiceProfileSitemapEntries()).toEqual([
            { slug: 'roza', updatedAt: UPDATED_AT },
        ]);

        const where = render(query(0).where);
        expect(where.params).toEqual(['active']);
        expect(where.sql).toContain('"services"."slug" is not null');
    });

    it('pomija wpis bez slugu, nawet gdy baza go zwrocila', async () => {
        mockDb.results = [[{ slug: null, updatedAt: UPDATED_AT }]];

        expect(await getServiceProfileSitemapEntries()).toEqual([]);
    });

    it('blad bazy przechodzi do wolajacego', async () => {
        jest.spyOn(db, 'select').mockImplementationOnce(() => {
            throw new Error('connection refused');
        });

        await expect(getServiceProfileSitemapEntries()).rejects.toThrow('connection refused');
    });
});
