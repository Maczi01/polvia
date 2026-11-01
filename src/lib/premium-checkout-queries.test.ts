/**
 * @jest-environment node
 */
import { is, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { getPremiumCheckoutTarget } from './premium-checkout-queries';

/** Baza to zewnetrzny serwis: mock fluent API z zapisem WHERE i JOIN jednego zapytania. */
const mockDb: { rows: unknown[]; where: unknown; joins: unknown[]; limit: number | undefined } = {
    rows: [],
    where: undefined,
    joins: [],
    limit: undefined,
};

jest.mock('@/db', () => {
    const query = {
        from: () => query,
        leftJoin: (_table: unknown, condition: unknown) => {
            mockDb.joins.push(condition);
            return query;
        },
        where: (condition: unknown) => {
            mockDb.where = condition;
            return query;
        },
        limit: async (count: number) => {
            mockDb.limit = count;
            return mockDb.rows.slice(0, count);
        },
    };
    return { db: { select: () => query } };
});

function render(condition: unknown): { sql: string; params: unknown[] } {
    if (!is(condition, SQL)) throw new Error('oczekiwano wyrazenia SQL');
    return new PgDialect().sqlToQuery(condition);
}

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';
const NOW = new Date('2026-11-01T12:00:00Z');
const ACTIVE = {
    status: 'active',
    currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
    cancelAtPeriodEnd: false,
};

beforeEach(() => {
    mockDb.rows = [];
    mockDb.where = undefined;
    mockDb.joins = [];
    mockDb.limit = undefined;
});

describe('getPremiumCheckoutTarget', () => {
    it('aktywny wpis bez subskrypcji: cel checkoutu bez premium', async () => {
        mockDb.rows = [{ id: SERVICE_ID, slug: 'roza', name: 'Roza', subscription: null, manualPremiumUntil: null }];

        expect(await getPremiumCheckoutTarget(SERVICE_ID, NOW)).toEqual({
            serviceId: SERVICE_ID,
            slug: 'roza',
            name: 'Roza',
            hasActivePremium: false,
        });
        expect(render(mockDb.where).params).toEqual([SERVICE_ID, 'active']);
        expect(mockDb.limit).toBe(1);
    });

    it('aktywna subskrypcja daje hasActivePremium, a join idzie wylacznie po id wpisu', async () => {
        mockDb.rows = [{ id: SERVICE_ID, slug: 'roza', name: 'Roza', subscription: ACTIVE, manualPremiumUntil: null }];

        expect((await getPremiumCheckoutTarget(SERVICE_ID, NOW))?.hasActivePremium).toBe(true);
        expect(mockDb.joins.map(join => render(join).sql)).toEqual([
            '"service_subscriptions"."service_id" = "services"."id"',
            '"service_profiles"."service_id" = "services"."id"',
        ]);
    });

    it('trwajace premium reczne blokuje checkout (hasActivePremium) bez subskrypcji', async () => {
        const manualPremiumUntil = new Date('2026-11-30T23:00:00.000Z');
        mockDb.rows = [{ id: SERVICE_ID, slug: 'roza', name: 'Roza', subscription: null, manualPremiumUntil }];

        expect((await getPremiumCheckoutTarget(SERVICE_ID, NOW))?.hasActivePremium).toBe(true);
    });

    it('wygasle premium reczne nie blokuje checkoutu', async () => {
        const manualPremiumUntil = new Date('2026-10-31T23:00:00.000Z');
        mockDb.rows = [{ id: SERVICE_ID, slug: 'roza', name: 'Roza', subscription: null, manualPremiumUntil }];

        expect((await getPremiumCheckoutTarget(SERVICE_ID, NOW))?.hasActivePremium).toBe(false);
    });

    it('brak aktywnego wpisu albo wpis bez slugu daje null', async () => {
        expect(await getPremiumCheckoutTarget(SERVICE_ID, NOW)).toBeNull();

        mockDb.rows = [{ id: SERVICE_ID, slug: null, name: 'Roza', subscription: null, manualPremiumUntil: null }];
        expect(await getPremiumCheckoutTarget(SERVICE_ID, NOW)).toBeNull();
    });
});
