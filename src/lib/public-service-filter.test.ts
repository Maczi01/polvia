import { PgDialect } from 'drizzle-orm/pg-core';

import { isPublicService } from '@/lib/public-service-filter';

describe('isPublicService', () => {
    const dialect = new PgDialect();

    it('przepuszcza wylacznie status active', () => {
        const query = dialect.sqlToQuery(isPublicService);

        expect(query.sql).toBe('"services"."status" = $1');
        expect(query.params).toEqual(['active']);
    });

    it('nie przepuszcza wpisow czekajacych na moderacje ani wylaczonych', () => {
        const { params } = dialect.sqlToQuery(isPublicService);

        expect(params).not.toContain('pending');
        expect(params).not.toContain('inactive');
    });
});
