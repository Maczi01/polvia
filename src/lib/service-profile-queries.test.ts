/**
 * @jest-environment node
 */
import {
    fakeProfileDb,
    location,
    query,
    render,
    resetFakeProfileDb,
    SERVICE_ROW,
} from '../../tests/fixtures/premium/fake-profile-db';
import { premiumBlock } from '../../tests/fixtures/premium/premium-block';
import { getServiceProfile } from './service-profile-queries';

jest.mock(
    '@/db',
    () => jest.requireActual('../../tests/fixtures/premium/fake-profile-db').fakeProfileDbModule,
);

beforeEach(() => {
    resetFakeProfileDb();
});

describe('getServiceProfile', () => {
    it('zwraca nazwe i opis z tlumaczenia uk razem z lokalizacjami', async () => {
        fakeProfileDb.results = [[SERVICE_ROW], [location()]];

        const profile = await getServiceProfile('roza', 'uk');

        expect(profile).toEqual({
            ...SERVICE_ROW,
            slug: 'roza',
            locations: [location()],
            subscription: null,
        });
        expect(render(query(0).joins[0]).params).toContain('uk');
    });

    it('profil niesie stan subskrypcji z left joina service_subscriptions', async () => {
        const subscription = {
            status: 'active',
            currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
            cancelAtPeriodEnd: false,
        };
        fakeProfileDb.results = [[{ ...SERVICE_ROW, subscription }], [location()]];

        const profile = await getServiceProfile('roza', 'uk');

        expect(profile?.subscription).toEqual(subscription);
    });

    it('profil niesie date premium recznego z left joina service_profiles', async () => {
        const manualPremiumUntil = new Date('2026-11-30T23:00:00.000Z');
        fakeProfileDb.results = [[{ ...SERVICE_ROW, manualPremiumUntil }], [location()]];

        const profile = await getServiceProfile('roza', 'pl');

        expect(profile?.manualPremiumUntil).toEqual(manualPremiumUntil);
        expect(query(0).selected).toHaveProperty('manualPremiumUntil');
    });

    it('data premium recznego uslugi A nie wlacza premium usludze B: join po id tego wpisu', async () => {
        fakeProfileDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'pl');

        const joins = query(0).joins.map(join => render(join).sql);
        expect(joins.filter(join => join.includes('service_profiles'))).toEqual([
            '"service_profiles"."service_id" = "services"."id"',
        ]);
    });

    it('subskrypcja uslugi A nie wlacza premium usludze B: join wylacznie po id tego wpisu', async () => {
        fakeProfileDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'pl');

        const joins = query(0).joins.map(join => render(join).sql);
        expect(joins).toContain('"service_subscriptions"."service_id" = "services"."id"');
        // Jedyny warunek joina subskrypcji — bez OR, bez stalej, bez innej kolumny.
        expect(joins.filter(join => join.includes('service_subscriptions'))).toHaveLength(1);
    });

    it('lokalizacje pobiera rownolegle, po slugu aktywnego wpisu (nie po id z pierwszego zapytania)', async () => {
        fakeProfileDb.results = [[SERVICE_ROW], [location()]];

        await getServiceProfile('roza', 'uk');

        expect(fakeProfileDb.queries).toHaveLength(2);
        expect(render(query(1).where).params).toEqual(['roza', 'active']);
    });

    it('przy braku tlumaczenia bierze services.name (COALESCE)', async () => {
        fakeProfileDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'uk');

        const name = render(query(0).selected.name).sql;
        expect(name).toMatch(/^COALESCE\(.*"name", "services"\."name"\)$/);
    });

    it('szuka po slugu wsrod aktywnych wpisow, a brak aktywnego daje null', async () => {
        fakeProfileDb.results = [[]];

        const profile = await getServiceProfile('roza', 'pl');

        expect(profile).toBeNull();
        const where = render(query(0).where);
        expect(where.sql).toContain('"services"."slug" = $1');
        expect(where.sql).toContain('"services"."status" = $2');
        expect(where.params).toEqual(['roza', 'active']);
    });

    it('wpis online-only zwraca lokalizacje bez wspolrzednych bez bledu', async () => {
        const online = location({ latitude: null, longitude: null, street: null });
        fakeProfileDb.results = [[{ ...SERVICE_ROW, coverage: 'online' }], [online]];

        const profile = await getServiceProfile('roza', 'pl');

        expect(profile?.locations).toEqual([online]);
        expect(profile?.locations[0]?.latitude).toBeNull();
    });

    it('tagi w locale profilu, z pusta tablica zamiast NULL', async () => {
        fakeProfileDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'ru');

        const tags = render(query(0).selected.tags);
        expect(tags.sql).toContain('ARRAY[]::text[]');
        expect(tags.params).toEqual(['ru']);
    });

    it('blad bazy przechodzi do wolajacego', async () => {
        fakeProfileDb.failure = new Error('connection refused');

        await expect(getServiceProfile('roza', 'pl')).rejects.toThrow('connection refused');
    });
});

describe('getServiceProfile — tresc premium', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('dolacza service_profiles left joinem po id uslugi', async () => {
        fakeProfileDb.results = [[SERVICE_ROW], []];

        await getServiceProfile('roza', 'pl');

        expect(render(query(0).joins[1]).sql).toBe(
            '"service_profiles"."service_id" = "services"."id"',
        );
    });

    it('brak wiersza service_profiles daje premium: null bez logu', async () => {
        fakeProfileDb.results = [[{ ...SERVICE_ROW, premium: null }], []];

        const profile = await getServiceProfile('roza', 'uk');

        expect(profile?.premium).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it('zwraca surowe kolumny tresci: walidacja i lokalizacja dopiero po decyzji widoku', async () => {
        const stored = premiumBlock();
        fakeProfileDb.results = [[{ ...SERVICE_ROW, premium: stored }], []];

        const profile = await getServiceProfile('roza', 'uk');

        expect(profile?.premium).toEqual(stored);
    });

    it('uszkodzony jsonb nie loguje bledu przy odczycie profilu (profil free go nie parsuje)', async () => {
        const broken = { ...premiumBlock(), faq: 'to nie jest lista', template: 'luxury' };
        fakeProfileDb.results = [[{ ...SERVICE_ROW, premium: broken }], [location()]];

        const profile = await getServiceProfile('roza', 'pl');

        expect(profile?.name).toBe(SERVICE_ROW.name);
        expect(profile?.locations).toEqual([location()]);
        expect(profile?.premium).toEqual(broken);
        expect(console.error).not.toHaveBeenCalled();
    });
});
