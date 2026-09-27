import { buildListRows } from '@/lib/map-list-rows';
import { countCardsByCategory, countListCards } from '@/lib/result-counts';
import { type CoverageFilters, splitServicesByCoverage } from '@/lib/service-coverage';
import type { PartialService } from '@/types';

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
        category: 'beauty',
        coverage: 'local',
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

/** Oddzialy jednej firmy — ten sam `serviceId`, rozne lokalizacje. */
function branches(serviceId: string, count: number, overrides: Partial<PartialService> = {}) {
    return Array.from({ length: count }, () => service({ serviceId, ...overrides }));
}

const NO_FILTERS: CoverageFilters = { query: '', category: null, county: null, city: null, onlineOnly: false };

/** Karty, ktore lista faktycznie wyrenderuje — liczone z modelu wierszy, nie z licznika. */
function renderedCardCount(services: PartialService[], filters: CoverageFilters): number {
    const { localResults, onlineResults } = splitServicesByCoverage(services, filters);
    return buildListRows({
        main: localResults,
        online: onlineResults,
        embedding: [],
        isLoadingEmbeddings: false,
    }).filter(row => row.kind === 'card' || row.kind === 'group').length;
}

describe('countListCards', () => {
    it('firma wielooddzialowa to jedna karta, nie liczba jej lokalizacji', () => {
        const services = [...branches('slowianoczka', 8), service(), service()];

        expect(countListCards(services)).toBe(3);
    });

    it('pusta sekcja daje zero', () => {
        expect(countListCards([])).toBe(0);
    });
});

describe('countCardsByCategory', () => {
    const catalog = [
        ...branches('siec-salonow', 5, { category: 'beauty', city: 'Kraków', voivodeship: 'małopolskie' }),
        service({ category: 'beauty', city: 'Warszawa', voivodeship: 'mazowieckie' }),
        service({ category: 'beauty', city: 'Białystok', voivodeship: 'podlaskie' }),
        service({ category: 'law', coverage: 'online', latitude: null, longitude: null }),
        service({ category: 'law', city: 'Białystok', voivodeship: 'podlaskie' }),
        service({ category: 'financial', coverage: 'hybrid', city: 'Gdańsk', voivodeship: 'pomorskie' }),
    ];

    it('liczba przy kategorii zgadza sie z liczba kart po wybraniu tej kategorii', () => {
        const filters = { ...NO_FILTERS, county: 'podlaskie' };

        const counts = countCardsByCategory(catalog, filters);

        for (const category of ['beauty', 'law', 'financial', 'education']) {
            expect(counts[category]).toBe(renderedCardCount(catalog, { ...filters, category }));
        }
    });

    it('liczy firmy, nie lokalizacje', () => {
        const counts = countCardsByCategory(catalog, NO_FILTERS);

        // siec (5 punktow = 1 karta) + Warszawa + Bialystok
        expect(counts.beauty).toBe(3);
    });

    it('uwzglednia aktywne wojewodztwo', () => {
        const counts = countCardsByCategory(catalog, { ...NO_FILTERS, county: 'podlaskie' });

        expect(counts.beauty).toBe(1);
        // lokalny w podlaskim + zdalny, ktory sekcja online pokazuje niezaleznie od miejsca
        expect(counts.law).toBe(2);
        // hybrid z Gdanska obsluguje zdalnie, wiec trafia do sekcji online
        expect(counts.financial).toBe(1);
    });

    it('ignoruje aktywna kategorie — kazda kategoria liczona jest dla siebie', () => {
        const counts = countCardsByCategory(catalog, { ...NO_FILTERS, category: 'law' });

        expect(counts.beauty).toBe(3);
        expect(counts.law).toBe(2);
    });

    it('kategoria bez wpisow dostaje zero, a nie brak klucza', () => {
        const counts = countCardsByCategory(catalog, NO_FILTERS);

        expect(counts.education).toBe(0);
    });
});
