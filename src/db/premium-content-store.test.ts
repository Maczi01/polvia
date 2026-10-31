/**
 * @jest-environment node
 */
import { drizzle } from 'drizzle-orm/postgres-js';

import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { premiumContentSchema } from './premium-content-schema';
import { buildSavePremiumContentQuery, withServiceSlug } from './premium-content-store';

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
