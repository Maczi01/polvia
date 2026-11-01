import { isAliasableServiceSlug, isReservedRootSegment } from '@/lib/service-slug-alias';

describe('isReservedRootSegment', () => {
    it.each(['wp-admin', 'wp-login', 'phpmyadmin', 'xmlrpc', 'env', 'admin', 'cgi-bin'])(
        '%s (sciezka skanera bez kropki) jest zarezerwowany',
        segment => {
            expect(isReservedRootSegment(segment)).toBe(true);
        },
    );

    it.each(['mapa', 'cennik', 'api', 'firma', 'en'])(
        '%s (trasa albo locale) jest zarezerwowany',
        segment => {
            expect(isReservedRootSegment(segment)).toBe(true);
        },
    );

    it.each(['kancelaria-nowak', 'wp-serwis', 'admin-2'])('%s nie jest zarezerwowany', segment => {
        expect(isReservedRootSegment(segment)).toBe(false);
    });
});

describe('isAliasableServiceSlug', () => {
    it.each(['kancelaria-nowak', 'blog-2', 'firma-2'])('%s moze dostac krotki adres', slug => {
        expect(isAliasableServiceSlug(slug)).toBe(true);
    });

    it('slug zaczynajacy sie od api dostaje alias — matcher wyklucza tylko /api/**', () => {
        expect(isAliasableServiceSlug('apiary')).toBe(true);
        expect(isAliasableServiceSlug('api-serwis')).toBe(true);
    });

    it.each(['blog', 'mapa', 'cennik', 'api', 'wp-admin', 'en'])(
        '%s (segment zarezerwowany) nie moze dostac krotkiego adresu',
        slug => {
            expect(isAliasableServiceSlug(slug)).toBe(false);
        },
    );

    it.each(['Abc', 'a--b', '-abc', '', 'robots.txt'])(
        '%s (zly format) nie moze dostac aliasu',
        slug => {
            expect(isAliasableServiceSlug(slug)).toBe(false);
        },
    );
});
