/**
 * @jest-environment node
 */
import { drizzle } from 'drizzle-orm/postgres-js';

import { buildExtendPromotionQuery, buildRemovePromotionQuery } from './promotion-queries';

describe('buildExtendPromotionQuery', () => {
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

describe('buildRemovePromotionQuery', () => {
    const query = buildRemovePromotionQuery(drizzle.mock(), 'svc-1').toSQL();

    it('usuwa tylko wiersz tej uslugi', () => {
        expect(query.sql).toMatch(
            /^delete from "promoted_services" where \("promoted_services"\."service_id" = \$1 and /,
        );
    });

    it('zostawia wiersz, gdy trwa premium reczne tej samej uslugi (NOT EXISTS … > NOW())', () => {
        expect(query.sql).toContain(
            'not exists (select "service_id" from "service_profiles" where ' +
                '("service_profiles"."service_id" = $2 and "service_profiles"."manual_premium_until" > NOW()))',
        );
    });

    it('obie granice dostaja id uslugi jako parametr, nie w tresci SQL', () => {
        expect(query.params).toEqual(['svc-1', 'svc-1']);
        expect(query.sql).not.toContain('svc-1');
    });
});
