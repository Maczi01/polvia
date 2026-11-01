/**
 * @jest-environment node
 */
import {
    fakeProfileDb,
    query,
    render,
    resetFakeProfileDb,
} from '../../tests/fixtures/premium/fake-profile-db';
import { getSimilarServices } from './service-profile-queries';
import { SIMILAR_SERVICES_LIMIT, type SimilarServicesSource } from './similar-services';

jest.mock(
    '@/db',
    () => jest.requireActual('../../tests/fixtures/premium/fake-profile-db').fakeProfileDbModule,
);

beforeEach(() => {
    resetFakeProfileDb();
});

describe('getSimilarServices', () => {
    const SOURCE: SimilarServicesSource = {
        serviceId: 'svc-1',
        category: 'law',
        city: ' Warszawa ',
    };

    function candidate(id: string, slug: string | null = id) {
        return {
            serviceId: id,
            slug,
            name: `Firma ${id}`,
            image: null,
            city: 'Warszawa',
            category: 'law',
        };
    }

    it('jedno zapytanie z limitem w SQL, bez ponownego pobierania kategorii i miasta zrodla', async () => {
        fakeProfileDb.results = [[candidate('a'), candidate('b')]];

        const similar = await getSimilarServices(SOURCE, 'pl');

        expect(similar.map(item => item.serviceId)).toEqual(['a', 'b']);
        expect(fakeProfileDb.queries).toHaveLength(1);
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
        expect(sameCity?.sql).toMatch(
            /lower\(btrim\(.*"service_locations"\."city".*\)\) = lower\(\$\d+\)/,
        );
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
        fakeProfileDb.results = [[candidate('a', null)]];

        expect(await getSimilarServices(SOURCE, 'pl')).toEqual([]);
    });

    it('blad bazy przechodzi do wolajacego', async () => {
        fakeProfileDb.failure = new Error('connection refused');

        await expect(getSimilarServices(SOURCE, 'pl')).rejects.toThrow('connection refused');
    });
});
