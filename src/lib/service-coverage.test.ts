import { SERVICE_LANGUAGES } from '@/lib/languages';
import {
    type CoverageFilters,
    filterSemanticResults,
    matchesLanguage,
    matchesServiceLocation,
    splitServicesByCoverage,
} from '@/lib/service-coverage';
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

        it('szukanie tekstowe ignoruje polskie znaki w danych', () => {
            const zeZnakami = service({ name: 'Biuro Tłumaczeń', description: 'Księgowość' });
            const bezDopasowania = service({ name: 'Fryzjer' });

            const poTlumaczu = splitServicesByCoverage([zeZnakami, bezDopasowania], {
                ...NO_FILTERS,
                query: 'tlumacz',
            });
            const poKsiegowej = splitServicesByCoverage([zeZnakami, bezDopasowania], {
                ...NO_FILTERS,
                query: 'ksiegowo',
            });

            expect(ids(poTlumaczu.localResults)).toEqual([zeZnakami.id]);
            expect(ids(poKsiegowej.localResults)).toEqual([zeZnakami.id]);
        });

        it('szukanie tekstowe ignoruje polskie znaki w zapytaniu', () => {
            const bezZnakow = service({ name: 'Wynajem samochodow', tags: ['sprzatanie'] });
            const bezDopasowania = service({ name: 'Fryzjer' });

            const poSamochodzie = splitServicesByCoverage([bezZnakow, bezDopasowania], {
                ...NO_FILTERS,
                query: 'SAMOCHÓD',
            });
            const poSprzataniu = splitServicesByCoverage([bezZnakow, bezDopasowania], {
                ...NO_FILTERS,
                query: 'sprzątanie',
            });

            expect(ids(poSamochodzie.localResults)).toEqual([bezZnakow.id]);
            expect(ids(poSprzataniu.localResults)).toEqual([bezZnakow.id]);
        });

        describe('forma z diakrytykami i bez daje identyczny zbior wynikow', () => {
            // Dane celowo niespojne: czesc wpisow ze znakami, czesc bez, lokalne i online.
            const katalog = [
                service({ name: 'Księgowa Anna' }),
                service({ name: 'Biuro ksiegowe', coverage: 'online' }),
                service({ name: 'Biuro Tłumaczeń', coverage: 'hybrid' }),
                service({ name: 'Tlumacz przysiegly' }),
                service({ name: 'Salon masażu' }),
                service({ name: 'Masaz tajski', coverage: 'online' }),
                service({ name: 'Firma', tags: ['sprzątanie'] }),
                service({ name: 'Ekipa', tags: ['sprzatanie biur'] }),
                service({ name: 'Wynajem samochodów' }),
                service({ name: 'Naprawa samochod', coverage: 'online' }),
                service({ name: 'Юрист', description: 'Офіс: м. Київ' }),
                service({ name: 'Перекладач', description: 'Киів та онлайн', coverage: 'online' }),
                service({ name: 'Нотариус Семён' }),
                service({ name: 'Бухгалтер Семен', coverage: 'online' }),
                service({ name: 'Fryzjer' }),
            ];

            const wyniki = (query: string) => {
                const { localResults, onlineResults } = splitServicesByCoverage(katalog, {
                    ...NO_FILTERS,
                    query,
                });
                return { local: ids(localResults), online: ids(onlineResults) };
            };

            it.each([
                ['księgowa', 'ksiegowa'],
                ['tłumacz', 'tlumacz'],
                ['masaż', 'masaz'],
                ['sprzątanie', 'sprzatanie'],
                ['samochód', 'samochod'],
                ['Київ', 'Киів'],
                ['Семён', 'Семен'],
            ])('"%s" i "%s"', (zeZnakami, bezZnakow) => {
                const zZnakami = wyniki(zeZnakami);

                expect(wyniki(bezZnakow)).toEqual(zZnakami);
                expect([...zZnakami.local, ...zZnakami.online].length).toBeGreaterThanOrEqual(2);
            });
        });

        it('ignorowanie polskich znakow nie rozluznia dopasowania innych liter', () => {
            const masaz = service({ name: 'Salon masażu' });

            const { localResults } = splitServicesByCoverage([masaz], {
                ...NO_FILTERS,
                query: 'masas',
            });

            expect(localResults).toHaveLength(0);
        });

        it('zapytanie wielowyrazowe dopasowuje slowa niezaleznie od kolejnosci i pola', () => {
            const szkola = service({ name: 'Lingua City', description: 'Kursy języka polskiego' });
            const bezDopasowania = service({ name: 'Polski Sklep', description: 'Artykuły' });

            const { localResults } = splitServicesByCoverage([szkola, bezDopasowania], {
                ...NO_FILTERS,
                query: 'polskiego  kurs',
            });

            expect(ids(localResults)).toEqual([szkola.id]);
        });

        it('zapytanie wielowyrazowe wymaga dopasowania kazdego slowa', () => {
            const tylkoJedno = service({ name: 'Szkoła językowa' });

            const { localResults } = splitServicesByCoverage([tylkoJedno], {
                ...NO_FILTERS,
                query: 'szkola jazdy',
            });

            expect(localResults).toHaveLength(0);
        });

        it('slowo w mianowniku trafia w inne formy fleksyjne', () => {
            const ubezpieczenia = service({ name: 'Doradca', description: 'Ubezpieczenia OC i AC' });
            const ubezpieczen = service({ name: 'Porównywarka ubezpieczeń' });
            const bezDopasowania = service({ name: 'Fryzjer' });

            const { localResults } = splitServicesByCoverage(
                [ubezpieczenia, ubezpieczen, bezDopasowania],
                { ...NO_FILTERS, query: 'ubezpieczenie' },
            );

            expect(ids(localResults)).toEqual([ubezpieczenia.id, ubezpieczen.id]);
        });

        it('nie obcina koncowki, gdy zostalby zbyt krotki rdzen', () => {
            const barber = service({ name: 'Barber Shop' });

            const { localResults } = splitServicesByCoverage([barber], {
                ...NO_FILTERS,
                query: 'bary',
            });

            expect(localResults).toHaveLength(0);
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

    describe('jezyk obslugi jest trzecia osia filtra (R1, R6, R12)', () => {
        it('wybrany jezyk zostawia tylko wpisy z tym jezykiem w obu kubelkach', () => {
            const localRu = service({ coverage: 'local', languages: ['pl', 'ru'] });
            const localPl = service({ coverage: 'local', languages: ['pl'] });
            const onlineRu = service({ coverage: 'online', languages: ['ru'] });
            const onlineUk = service({ coverage: 'online', languages: ['uk', 'en'] });

            const { localResults, onlineResults } = splitServicesByCoverage(
                [localRu, localPl, onlineRu, onlineUk],
                { ...NO_FILTERS, language: 'ru' },
            );

            expect(ids(localResults)).toEqual([localRu.id]);
            expect(ids(onlineResults)).toEqual([onlineRu.id]);
        });

        it('language: null i brak pola daja wynik sprzed wprowadzenia osi jezyka', () => {
            const catalog = [
                service({ coverage: 'local', languages: ['pl'] }),
                service({ coverage: 'local', languages: [] }),
                service({ coverage: 'online', languages: ['de'] }),
                service({ coverage: 'hybrid', city: 'Gdansk', voivodeship: 'pomorskie' }),
            ];

            const withNull = splitServicesByCoverage(catalog, { ...NO_FILTERS, language: null });
            const withoutField = splitServicesByCoverage(catalog, NO_FILTERS);

            expect(withNull.localResults).toHaveLength(3);
            expect(withNull.onlineResults).toHaveLength(1);
            expect(ids(withoutField.localResults)).toEqual(ids(withNull.localResults));
            expect(ids(withoutField.onlineResults)).toEqual(ids(withNull.onlineResults));
        });

        it('kategoria + miasto + jezyk zaweza do przeciecia', () => {
            const trafiony = service({ category: 'law', city: 'Warszawa', languages: ['ru'] });
            const innyJezyk = service({ category: 'law', city: 'Warszawa', languages: ['pl'] });
            const innaKategoria = service({
                category: 'beauty',
                city: 'Warszawa',
                languages: ['ru'],
            });
            const inneMiasto = service({
                category: 'law',
                city: 'Krakow',
                voivodeship: 'malopolskie',
                languages: ['ru'],
            });

            const { localResults, onlineResults } = splitServicesByCoverage(
                [trafiony, innyJezyk, innaKategoria, inneMiasto],
                { ...NO_FILTERS, category: 'law', city: 'Warszawa', language: 'ru' },
            );

            expect(ids(localResults)).toEqual([trafiony.id]);
            expect(onlineResults).toHaveLength(0);
        });

        it('onlineOnly + jezyk: lista lokalna pusta, sekcja online zawezona jezykiem', () => {
            const localRu = service({ coverage: 'local', languages: ['ru'] });
            const onlineRu = service({ coverage: 'online', languages: ['ru'] });
            const onlinePl = service({ coverage: 'online', languages: ['pl'] });
            const hybridRu = service({ coverage: 'hybrid', languages: ['ru', 'pl'] });

            const { localResults, onlineResults } = splitServicesByCoverage(
                [localRu, onlineRu, onlinePl, hybridRu],
                { ...NO_FILTERS, onlineOnly: true, language: 'ru' },
            );

            expect(localResults).toHaveLength(0);
            expect(ids(onlineResults)).toEqual([onlineRu.id, hybridRu.id]);
        });

        it('tekst + jezyk: wpis musi trafic w zapytanie ORAZ obslugiwac jezyk', () => {
            const notariuszRu = service({ name: 'Notariusz Kowalski', languages: ['ru'] });
            const notariuszPl = service({ name: 'Notariusz Nowak', languages: ['pl'] });
            const fryzjerRu = service({ name: 'Fryzjer Iwanow', languages: ['ru'] });

            const { localResults } = splitServicesByCoverage(
                [notariuszRu, notariuszPl, fryzjerRu],
                { ...NO_FILTERS, query: 'notariusz', language: 'ru' },
            );

            expect(ids(localResults)).toEqual([notariuszRu.id]);
        });
    });
});

// Wyniki semantyczne nie przechodza przez kubelkowanie, wiec dostaja osobna funkcje —
// z tymi samymi predykatami miejsca, kategorii i jezyka co lista.
describe('filterSemanticResults', () => {
    it('bez filtrow zwraca wszystkie wyniki w kolejnosci wejsciowej', () => {
        const pierwszy = service({ coverage: 'online' });
        const drugi = service({ coverage: 'local' });

        expect(ids(filterSemanticResults([pierwszy, drugi], NO_FILTERS))).toEqual([
            pierwszy.id,
            drugi.id,
        ]);
    });

    it('wynik bez wybranego jezyka odpada przy aktywnym filtrze jezyka', () => {
        const ru = service({ languages: ['pl', 'ru'] });
        const pl = service({ languages: ['pl'] });

        const result = filterSemanticResults([ru, pl], { ...NO_FILTERS, language: 'ru' });

        expect(ids(result)).toEqual([ru.id]);
    });

    it('zaweza po miescie przed wojewodztwem i po kategorii bez wzgledu na wielkosc liter', () => {
        const trafiony = service({ category: 'law', city: 'Warszawa' });
        const inneMiasto = service({ category: 'law', city: 'Radom' });
        const innaKategoria = service({ category: 'beauty', city: 'Warszawa' });

        const result = filterSemanticResults([trafiony, inneMiasto, innaKategoria], {
            ...NO_FILTERS,
            category: 'LAW',
            county: 'mazowieckie',
            city: 'warszawa',
        });

        expect(ids(result)).toEqual([trafiony.id]);
    });

    it('nie stosuje filtra tekstowego — wynik semantyczny nie musi zawierac slow zapytania', () => {
        const wynik = service({ name: 'Kancelaria Lex' });

        const result = filterSemanticResults([wynik], { ...NO_FILTERS, query: 'prawnik' });

        expect(ids(result)).toEqual([wynik.id]);
    });
});

describe('matchesLanguage', () => {
    it('bez wybranego jezyka przepuszcza kazdy wpis, takze bez jezykow', () => {
        expect(matchesLanguage(service({ languages: [] }), null)).toBe(true);
        // Pole nieobecne w filtrach (`undefined`) — przez obiekt, bo literalny `undefined`
        // jako argument blokuje `unicorn/no-useless-undefined`.
        const filtersWithoutLanguage: CoverageFilters = {};
        const plOnly = service({ languages: ['pl'] });
        expect(matchesLanguage(plOnly, filtersWithoutLanguage.language)).toBe(true);
    });

    it('przepuszcza wpis, ktorego lista zawiera wybrany jezyk (takze z duplikatami)', () => {
        expect(matchesLanguage(service({ languages: ['pl', 'ru', 'ru'] }), 'ru')).toBe(true);
    });

    it('wpis bez jezykow nie pasuje do wybranego jezyka', () => {
        expect(matchesLanguage(service({ languages: [] }), 'pl')).toBe(false);
    });

    it('wpis z samym nieznanym kodem nie pasuje do zadnego jezyka', () => {
        const niemiecki = service({ languages: ['de'] });

        for (const language of SERVICE_LANGUAGES) {
            expect(matchesLanguage(niemiecki, language)).toBe(false);
        }
    });
});

// Predykat jest eksportowany, bo poza lista uzywa go mapa — piny musza mowic o tym
// samym miejscu co wyniki. Dlatego ma wlasne badania, nie tylko przez kubelkowanie.
describe('matchesServiceLocation', () => {
    it('bez filtra geograficznego przepuszcza kazdy wpis', () => {
        const wroclaw = service({ city: 'Wroclaw', voivodeship: 'dolnoslaskie' });

        expect(matchesServiceLocation(wroclaw, { county: null, city: null })).toBe(true);
    });

    it('filtr wojewodztwa odrzuca wpis z innego wojewodztwa', () => {
        const wroclaw = service({ city: 'Wroclaw', voivodeship: 'dolnoslaskie' });

        expect(matchesServiceLocation(wroclaw, { county: 'podlaskie', city: null })).toBe(false);
        expect(matchesServiceLocation(wroclaw, { county: 'dolnoslaskie', city: null })).toBe(true);
    });

    it('miasto ma priorytet nad wojewodztwem', () => {
        const gdynia = service({ city: 'Gdynia', voivodeship: 'pomorskie' });

        // Wojewodztwo sie zgadza, miasto nie — wpis odpada.
        expect(matchesServiceLocation(gdynia, { county: 'pomorskie', city: 'Gdansk' })).toBe(false);
    });

    it('nie patrzy na wielkosc liter', () => {
        const bialystok = service({ city: 'Bialystok', voivodeship: 'podlaskie' });

        expect(matchesServiceLocation(bialystok, { county: 'PODLASKIE', city: null })).toBe(true);
        expect(matchesServiceLocation(bialystok, { county: null, city: 'bialystok' })).toBe(true);
    });

    // Wpis w pelni zdalny moze nie miec adresu wcale. Przy aktywnym filtrze miejsca
    // nie ma czym dowiesc, ze tam jest — wiec odpada, zamiast przechodzic po cichu.
    it('wpis bez adresu odpada przy aktywnym filtrze miejsca', () => {
        const bezAdresu = service({ coverage: 'online', city: null, voivodeship: null });

        expect(matchesServiceLocation(bezAdresu, { county: 'podlaskie', city: null })).toBe(false);
        expect(matchesServiceLocation(bezAdresu, { county: null, city: null })).toBe(true);
    });
});
