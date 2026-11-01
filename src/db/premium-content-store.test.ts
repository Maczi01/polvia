/**
 * @jest-environment node
 */
import { drizzle } from 'drizzle-orm/postgres-js';

import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { premiumContentSchema } from './premium-content-schema';
import {
    buildExtendPromotionQuery,
    buildSavePremiumContentQuery,
    manualPremiumUntilOf,
    withServiceSlug,
} from './premium-content-store';

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

    it('ranking: upsert promoted_services, ktory nie skraca dluzszego terminu (GREATEST)', () => {
        const until = new Date('2026-11-30T23:00:00.000Z');

        const query = buildExtendPromotionQuery(drizzle.mock(), 'svc-1', until).toSQL();

        expect(query.sql).toMatch(/^insert into "promoted_services"/);
        expect(query.sql).toContain(
            'on conflict ("service_id") do update set "expires_at" = GREATEST("promoted_services"."expires_at", excluded.expires_at)',
        );
        expect(query.sql).not.toContain('"priority" =');
        expect(query.params).toEqual(['svc-1', until.toISOString()]);
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
