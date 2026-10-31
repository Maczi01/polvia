/**
 * @jest-environment node
 */
import { is, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import {
    getServiceProfile,
    getServiceSlugStatus,
    getSimilarServices,
    type ServiceProfileLocation,
} from './service-profile-queries';

/** Jedno zapytanie zbudowane na mocku: co wybralo, z jakim WHERE/JOIN i LIMIT. */
interface RecordedQuery {
    selected: Record<string, unknown>;
    joins: unknown[];
    where: unknown;
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
        const record: RecordedQuery = { selected, joins: [], where: undefined, limit: undefined };
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
            where: (condition: unknown) => {
                record.where = condition;
                return awaitable();
            },
            orderBy: () => awaitable(),
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
    if (!is(condition, SQL)) throw new Error('oczekiwano wyrazenia SQL');
    return new PgDialect().sqlToQuery(condition);
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
        expect(render(query(1).where).params).toEqual(['svc-1']);
    });

    it('przy braku tlumaczenia bierze services.name (COALESCE)', async () => {
        mockDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'uk');

        expect(render(query(0).selected.name).sql).toBe(
            'COALESCE("services_translations_alias"."name", "services"."name")',
        );
    });

    it('szuka po slugu wsrod aktywnych wpisow, a brak aktywnego daje null', async () => {
        mockDb.results = [[]];

        const profile = await getServiceProfile('roza', 'pl');

        expect(profile).toBeNull();
        const where = render(query(0).where);
        expect(where.sql).toContain('"services"."slug" = $1');
        expect(where.sql).toContain('"services"."status" = $2');
        expect(where.params).toEqual(['roza', 'active']);
        expect(mockDb.queries).toHaveLength(1);
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
    const SOURCE = { serviceId: 'svc-1', category: 'legal', city: 'Warszawa' };

    function candidate(id: string, city: string | null, category = 'legal') {
        return { serviceId: id, slug: id, name: `Firma ${id}`, image: null, city, category };
    }

    it('zwraca najwyzej 6 firm tej samej kategorii, z miasta zrodla na poczatku', async () => {
        const others = Array.from({ length: 7 }, (_, index) => candidate(`k${index}`, 'Kraków'));
        mockDb.results = [[SOURCE], [...others, candidate('w1', 'Warszawa')]];

        const similar = await getSimilarServices('svc-1', 'pl');

        expect(similar).toHaveLength(6);
        expect(similar[0]?.serviceId).toBe('w1');
        expect(similar.map(item => item.serviceId)).not.toContain('svc-1');
    });

    it('filtruje w SQL: aktywne, ta sama kategoria, bez wlasnego wpisu, ze slugiem', async () => {
        mockDb.results = [[SOURCE], []];

        await getSimilarServices('svc-1', 'uk');

        const where = render(query(1).where);
        expect(where.params).toEqual(['active', 'legal', 'svc-1']);
        expect(where.sql).toContain('"services"."id" <> $3');
        expect(where.sql).toContain('"services"."slug" is not null');
        expect(render(query(1).joins[0]).params).toContain('uk');
    });

    it('pomija kandydata bez slugu, nawet gdy baza go zwrocila', async () => {
        mockDb.results = [[SOURCE], [{ ...candidate('a', 'Warszawa'), slug: null }]];

        expect(await getSimilarServices('svc-1', 'pl')).toEqual([]);
    });

    it('nieznana usluga zrodlowa daje pusta liste bez drugiego zapytania', async () => {
        mockDb.results = [[]];

        expect(await getSimilarServices('brak', 'pl')).toEqual([]);
        expect(mockDb.queries).toHaveLength(1);
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
