import { splitServicesByCoverage } from '@/lib/service-coverage';
import type { Coverage, PartialService } from '@/types';

let counter = 0;

/** Minimalna usluga; nadpisujemy tylko to, co dane badanie faktycznie sprawdza. */
function service(overrides: Partial<PartialService> = {}): PartialService {
    counter += 1;
    return {
        id: `id-${counter}`,
        serviceId: `service-${counter}`,
        slug: `slug-${counter}`,
        name: `Usluga ${counter}`,
        description: null,
        category: 'financial',
        coverage: 'local' as Coverage,
        tags: null,
        city: 'Warszawa',
        street: null,
        voivodeship: 'mazowieckie',
        postcode: null,
        latitude: 52.2297,
        longitude: 21.0122,
        openingHours: {},
        phoneNumber: null,
        email: null,
        webpage: null,
        image: null,
        languages: ['pl'],
        socials: null,
        whatsappNumber: null,
        verified: false,
        ...overrides,
    };
}

const ids = (list: PartialService[]) => list.map(s => s.id);

const NO_FILTERS = { query: '', category: null, county: null, city: null, onlineOnly: false };

describe('splitServicesByCoverage', () => {
    describe('wpis hybrid trafia dokladnie do jednego kubelka (R6)', () => {
        it('bez filtra geograficznego — tylko lista lokalna', () => {
            const hybrid = service({ coverage: 'hybrid', city: 'Warszawa', voivodeship: 'mazowieckie' });

            const { localResults, onlineResults } = splitServicesByCoverage([hybrid], NO_FILTERS);

            expect(ids(localResults)).toEqual([hybrid.id]);
            expect(onlineResults).toHaveLength(0);
        });

        it('przy filtrze innego wojewodztwa — tylko sekcja online', () => {
            const hybrid = service({ coverage: 'hybrid', city: 'Warszawa', voivodeship: 'mazowieckie' });

            const { localResults, onlineResults } = splitServicesByCoverage([hybrid], {
                ...NO_FILTERS,
                county: 'pomorskie',
            });

            expect(localResults).toHaveLength(0);
            expect(ids(onlineResults)).toEqual([hybrid.id]);
        });

        it('przy filtrze wlasnego wojewodztwa — tylko lista lokalna', () => {
            const hybrid = service({ coverage: 'hybrid', city: 'Gdansk', voivodeship: 'pomorskie' });

            const { localResults, onlineResults } = splitServicesByCoverage([hybrid], {
                ...NO_FILTERS,
                county: 'pomorskie',
            });

            expect(ids(localResults)).toEqual([hybrid.id]);
            expect(onlineResults).toHaveLength(0);
        });
    });

    describe('granice kubelkow po zasiegu', () => {
        it('wpis online nigdy nie trafia do listy lokalnej', () => {
            const online = service({ coverage: 'online', latitude: null, longitude: null });

            for (const filters of [NO_FILTERS, { ...NO_FILTERS, county: 'mazowieckie' }]) {
                const { localResults, onlineResults } = splitServicesByCoverage([online], filters);
                expect(localResults).toHaveLength(0);
                expect(ids(onlineResults)).toEqual([online.id]);
            }
        });

        it('wpis local nigdy nie trafia do sekcji online', () => {
            const local = service({ coverage: 'local' });

            const { localResults, onlineResults } = splitServicesByCoverage([local], NO_FILTERS);

            expect(ids(localResults)).toEqual([local.id]);
            expect(onlineResults).toHaveLength(0);
        });

        it('wpis online nie jest odfiltrowywany przez filtr geograficzny (R5)', () => {
            const online = service({ coverage: 'online', city: 'Warszawa', voivodeship: 'mazowieckie' });

            const { onlineResults } = splitServicesByCoverage([online], {
                ...NO_FILTERS,
                county: 'podkarpackie',
            });

            expect(ids(onlineResults)).toEqual([online.id]);
        });
    });

    describe('deduplikacja wzgledem wynikow semantycznych (R6)', () => {
        it('wpis obecny w embeddingResults nie pojawia sie w sekcji online', () => {
            const online = service({ coverage: 'online' });

            const { onlineResults } = splitServicesByCoverage(
                [online],
                { ...NO_FILTERS, county: 'pomorskie' },
                [online],
            );

            expect(onlineResults).toHaveLength(0);
        });

        it('inny wpis w embeddingResults nie usuwa naszego', () => {
            const online = service({ coverage: 'online' });
            const inny = service({ coverage: 'online' });

            const { onlineResults } = splitServicesByCoverage(
                [online],
                { ...NO_FILTERS, county: 'pomorskie' },
                [inny],
            );

            expect(ids(onlineResults)).toEqual([online.id]);
        });
    });

    describe('kategoria jest ortogonalna do zasiegu (R2, R7)', () => {
        it('filtr kategorii przepuszcza wpis online tej kategorii', () => {
            const online = service({ coverage: 'online', category: 'law' });

            const { onlineResults } = splitServicesByCoverage([online], {
                ...NO_FILTERS,
                category: 'law',
            });

            expect(ids(onlineResults)).toEqual([online.id]);
        });

        it('filtr kategorii odrzuca wpis online innej kategorii z OBU kubelkow', () => {
            const online = service({ coverage: 'online', category: 'health' });

            const { localResults, onlineResults } = splitServicesByCoverage([online], {
                ...NO_FILTERS,
                category: 'law',
            });

            expect(localResults).toHaveLength(0);
            expect(onlineResults).toHaveLength(0);
        });
    });

    describe('tryb onlineOnly', () => {
        it('oproznia liste lokalna i zostawia online oraz hybrid', () => {
            const local = service({ coverage: 'local' });
            const online = service({ coverage: 'online' });
            const hybrid = service({ coverage: 'hybrid' });

            const { localResults, onlineResults } = splitServicesByCoverage(
                [local, online, hybrid],
                { ...NO_FILTERS, onlineOnly: true },
            );

            expect(localResults).toHaveLength(0);
            expect(ids(onlineResults)).toEqual([online.id, hybrid.id]);
        });

        it('filtr geograficzny nie zawezenia sekcji online', () => {
            const online = service({ coverage: 'online', voivodeship: 'mazowieckie' });

            const { onlineResults } = splitServicesByCoverage([online], {
                ...NO_FILTERS,
                onlineOnly: true,
                county: 'pomorskie',
            });

            expect(ids(onlineResults)).toEqual([online.id]);
        });
    });

    describe('zachowanie istniejacych filtrow', () => {
        it('filtr miasta ma priorytet nad wojewodztwem', () => {
            const wKrakowie = service({ city: 'Krakow', voivodeship: 'malopolskie' });
            const wWarszawie = service({ city: 'Warszawa', voivodeship: 'mazowieckie' });

            const { localResults } = splitServicesByCoverage([wKrakowie, wWarszawie], {
                ...NO_FILTERS,
                city: 'Krakow',
                county: 'mazowieckie',
            });

            expect(ids(localResults)).toEqual([wKrakowie.id]);
        });

        it('szukanie tekstowe obejmuje nazwe, opis, miasto, kategorie i tagi', () => {
            const poNazwie = service({ name: 'Ksiegowa Anna' });
            const poTagu = service({ name: 'Cos innego', tags: ['ksiegowosc'] });
            const bezDopasowania = service({ name: 'Fryzjer' });

            const { localResults } = splitServicesByCoverage(
                [poNazwie, poTagu, bezDopasowania],
                { ...NO_FILTERS, query: 'ksiego' },
            );

            expect(ids(localResults)).toEqual([poNazwie.id, poTagu.id]);
        });

        it('zachowuje kolejnosc wejsciowa — sortowanie pochodzi z zapytania', () => {
            const pierwszy = service({ coverage: 'online' });
            const drugi = service({ coverage: 'online' });
            const trzeci = service({ coverage: 'online' });

            const { onlineResults } = splitServicesByCoverage(
                [pierwszy, drugi, trzeci],
                NO_FILTERS,
            );

            expect(ids(onlineResults)).toEqual([pierwszy.id, drugi.id, trzeci.id]);
        });
    });

    it('pusta lista wejsciowa daje dwa puste kubelki', () => {
        const { localResults, onlineResults } = splitServicesByCoverage([], NO_FILTERS);

        expect(localResults).toHaveLength(0);
        expect(onlineResults).toHaveLength(0);
    });
});
