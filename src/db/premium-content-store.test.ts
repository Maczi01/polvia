/**
 * @jest-environment node
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { fakePostgres, resetFakePostgres } from '../../tests/fixtures/premium/fake-postgres';
import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { type PremiumContentData, premiumContentSchema } from './premium-content-schema';
import {
    buildSavePremiumContentQuery,
    createPremiumContentStore,
    manualPremiumUntilOf,
    type StoredPremiumContent,
    toEntryShape,
    withServiceSlug,
} from './premium-content-store';

/** Sterownik bazy to zewnetrzny serwis; Drizzle i adapter dzialaja prawdziwie. */
jest.mock(
    'postgres',
    () => jest.requireActual('../../tests/fixtures/premium/fake-postgres').fakePostgresModule,
);

const CONTENT = premiumContentSchema.parse(premiumBlock());

describe('buildSavePremiumContentQuery', () => {
    it('robi upsert po service_id (on conflict do update), nie drugi insert', () => {
        const query = buildSavePremiumContentQuery(drizzle.mock(), 'svc-1', CONTENT).toSQL();

        expect(query.sql).toMatch(/^insert into "service_profiles"/);
        expect(query.sql).toContain('on conflict ("service_id") do update set');
        expect(query.sql).toContain('"updated_at" = now()');
        expect(query.params).toContain('svc-1');
        expect(query.params).toContain(JSON.stringify(CONTENT.gallery));
    });
});

describe('premium reczne (activeUntil)', () => {
    const MANUAL = premiumContentSchema.parse(premiumBlock({ activeUntil: '2026-11-30' }));

    it('zapisuje koniec dnia activeUntil w Europe/Warsaw w manual_premium_until', () => {
        const query = buildSavePremiumContentQuery(drizzle.mock(), 'svc-1', MANUAL).toSQL();

        expect(query.sql).toContain('"manual_premium_until"');
        expect(query.params).toContainEqual(manualPremiumUntilOf(MANUAL)?.toISOString());
        expect(manualPremiumUntilOf(MANUAL)?.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    });

    it('blok bez activeUntil zeruje date (plik wpisu jest zrodlem prawdy)', () => {
        expect(manualPremiumUntilOf(CONTENT)).toBeNull();

        const query = buildSavePremiumContentQuery(drizzle.mock(), 'svc-1', CONTENT).toSQL();
        expect(query.sql).toContain('"manual_premium_until"');
        expect(query.params).not.toContain('2026-11-30T23:00:00.000Z');
    });
});

describe('withServiceSlug', () => {
    it('pomija usluge bez slugu (przed backfillem), reszte zwraca z id i slugiem', () => {
        expect(
            withServiceSlug([
                { id: 'svc-1', slug: 'salon-roza' },
                { id: 'svc-2', slug: null },
            ]),
        ).toEqual([{ id: 'svc-1', slug: 'salon-roza' }]);
    });

    it('same uslugi bez slugu daja pusta liste', () => {
        expect(withServiceSlug([{ id: 'svc-2', slug: null }])).toEqual([]);
    });
});

/** Wiersz, jaki zapisuje `buildSavePremiumContentQuery` (te same kolumny co odczyt). */
function storedRow(content: PremiumContentData): StoredPremiumContent {
    const { template, coverImage, gallery, priceList, faq, ratings } = content;
    return {
        template,
        coverImage,
        gallery,
        priceList,
        faq,
        ratings,
        manualPremiumUntil: manualPremiumUntilOf(content),
    };
}

describe('toEntryShape — wiersz z bazy w ksztalcie bloku z pliku (diff db:premium)', () => {
    it.each([
        ['zima (CET)', '2026-11-30', '2026-11-30T23:00:00.000Z'],
        ['lato (CEST)', '2026-07-15', '2026-07-15T22:00:00.000Z'],
    ])('%s: plik -> manual_premium_until -> ta sama data activeUntil', (_, date, stored) => {
        const content = premiumContentSchema.parse(premiumBlock({ activeUntil: date }));
        const row = storedRow(content);

        expect(row.manualPremiumUntil?.toISOString()).toBe(stored);
        expect(premiumContentSchema.parse(toEntryShape(row))).toEqual(content);
    });

    it('wiersz bez daty: blok bez activeUntil (nie "invalid" w diffie)', () => {
        const entry = toEntryShape(storedRow(CONTENT));

        expect(entry).not.toHaveProperty('activeUntil');
        expect(premiumContentSchema.parse(entry)).toEqual(CONTENT);
    });
});

describe('saveContent — zapis w jednej transakcji', () => {
    const store = createPremiumContentStore(drizzle({ client: postgres('postgres://fake') }));

    beforeEach(() => {
        resetFakePostgres();
    });

    it('z data: tresc i ranking (dwa zapisy) w jednej transakcji', async () => {
        const manual = premiumContentSchema.parse(premiumBlock({ activeUntil: '2026-11-30' }));

        await store.saveContent('svc-1', manual);

        expect(fakePostgres.transactions).toBe(1);
        expect(fakePostgres.statements.map(({ sql }) => sql.slice(0, 32))).toEqual([
            'insert into "service_profiles" (',
            'insert into "promoted_services" ',
        ]);
        expect(fakePostgres.statements.every(({ isInTransaction }) => isInTransaction)).toBe(true);
        expect(fakePostgres.statements[1]?.params).toEqual(['svc-1', '2026-11-30T23:00:00.000Z']);
    });

    it('bez daty: sama tresc, ranking nietkniety', async () => {
        await store.saveContent('svc-1', CONTENT);

        expect(fakePostgres.transactions).toBe(1);
        expect(fakePostgres.statements).toHaveLength(1);
        expect(fakePostgres.statements[0]?.sql).toMatch(/^insert into "service_profiles"/);
        expect(fakePostgres.statements[0]?.isInTransaction).toBe(true);
    });
});
