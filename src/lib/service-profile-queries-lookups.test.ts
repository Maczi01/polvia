/**
 * @jest-environment node
 */
import { db } from '@/db';

import {
    fakeProfileDb,
    query,
    render,
    resetFakeProfileDb,
} from '../../tests/fixtures/premium/fake-profile-db';
import { getServiceProfileSitemapEntries, getServiceSlugStatus } from './service-profile-queries';

jest.mock(
    '@/db',
    () => jest.requireActual('../../tests/fixtures/premium/fake-profile-db').fakeProfileDbModule,
);

beforeEach(() => {
    resetFakeProfileDb();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('getServiceSlugStatus', () => {
    const NOW = new Date('2026-11-01T12:00:00Z');
    const ACTIVE_SUBSCRIPTION = {
        status: 'active',
        currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
        cancelAtPeriodEnd: false,
    };

    it('aktywny wpis pod slugiem istnieje (bez subskrypcji: bez premium)', async () => {
        fakeProfileDb.results = [[{ id: 'svc-1', subscription: null }]];

        expect(await getServiceSlugStatus('roza', NOW)).toEqual({
            exists: true,
            hasActivePremium: false,
        });
        expect(render(query(0).where).params).toEqual(['roza', 'active']);
        expect(query(0).limit).toBe(1);
    });

    it('brak aktywnego wpisu pod slugiem', async () => {
        fakeProfileDb.results = [[]];

        expect(await getServiceSlugStatus('nie-ma', NOW)).toEqual({
            exists: false,
            hasActivePremium: false,
        });
    });

    it('aktywna subskrypcja daje hasActivePremium (isPremiumActive)', async () => {
        fakeProfileDb.results = [[{ id: 'svc-1', subscription: ACTIVE_SUBSCRIPTION }]];

        expect(await getServiceSlugStatus('roza', NOW)).toEqual({
            exists: true,
            hasActivePremium: true,
        });
    });

    it('anulowana subskrypcja nie daje premium', async () => {
        const canceled = { ...ACTIVE_SUBSCRIPTION, status: 'canceled' };
        fakeProfileDb.results = [[{ id: 'svc-1', subscription: canceled }]];

        expect((await getServiceSlugStatus('roza', NOW)).hasActivePremium).toBe(false);
    });

    it('join subskrypcji wylacznie po id wpisu spod slugu', async () => {
        fakeProfileDb.results = [[]];

        await getServiceSlugStatus('roza', NOW);

        expect(query(0).joins.map(join => render(join).sql)).toEqual([
            '"service_subscriptions"."service_id" = "services"."id"',
        ]);
    });
});

describe('getServiceProfileSitemapEntries', () => {
    const UPDATED_AT = new Date('2026-10-30T12:00:00Z');

    it('zwraca slugi z data aktualizacji, filtrujac w SQL aktywne wpisy ze slugiem', async () => {
        fakeProfileDb.results = [[{ slug: 'roza', updatedAt: UPDATED_AT }]];

        expect(await getServiceProfileSitemapEntries()).toEqual([
            { slug: 'roza', updatedAt: UPDATED_AT },
        ]);

        const where = render(query(0).where);
        expect(where.params).toEqual(['active']);
        expect(where.sql).toContain('"services"."slug" is not null');
    });

    it('pomija wpis bez slugu, nawet gdy baza go zwrocila', async () => {
        fakeProfileDb.results = [[{ slug: null, updatedAt: UPDATED_AT }]];

        expect(await getServiceProfileSitemapEntries()).toEqual([]);
    });

    it('blad bazy przechodzi do wolajacego', async () => {
        jest.spyOn(db, 'select').mockImplementationOnce(() => {
            throw new Error('connection refused');
        });

        await expect(getServiceProfileSitemapEntries()).rejects.toThrow('connection refused');
    });
});
