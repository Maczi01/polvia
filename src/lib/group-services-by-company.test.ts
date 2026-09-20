import { groupServicesByCompany } from '@/lib/group-services-by-company';
import type { PartialService } from '@/types';

let counter = 0;

function location(serviceId: string, city: string, overrides: Partial<PartialService> = {}): PartialService {
    counter += 1;

    return {
        id: `loc-${counter}`,
        serviceId,
        slug: `${serviceId}-${city.toLowerCase()}-${counter}`,
        name: serviceId,
        description: null,
        category: 'grocery',
        coverage: 'local',
        tags: null,
        city,
        street: 'ul. Testowa 1',
        voivodeship: 'mazowieckie',
        postcode: null,
        latitude: 52.23,
        longitude: 21.01,
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
    } as PartialService;
}

describe('groupServicesByCompany', () => {
    it('zostawia pojedyncze lokalizacje jako osobne wiersze', () => {
        const input = [location('alfa', 'Warszawa'), location('beta', 'Kraków')];

        const rows = groupServicesByCompany(input);

        expect(rows).toHaveLength(2);
        expect(rows.every(row => row.kind === 'single')).toBe(true);
    });

    it('zwija firme majaca tyle lokalizacji co prog', () => {
        const input = [
            location('alfa', 'Warszawa'),
            location('alfa', 'Kraków'),
            location('alfa', 'Gdańsk'),
        ];

        const rows = groupServicesByCompany(input);

        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe('group');
    });

    // Przy dwoch punktach zwijanie dokłada klikniecie, zeby oszczedzic jeden
    // wiersz — zla wymiana, wiec prog wynosi 3.
    it('NIE zwija firmy ponizej progu', () => {
        const input = [location('alfa', 'Warszawa'), location('alfa', 'Kraków')];

        const rows = groupServicesByCompany(input);

        expect(rows).toHaveLength(2);
        expect(rows.every(row => row.kind === 'single')).toBe(true);
    });

    // Wejscie jest juz posortowane po trafnosci, promowaniu i klikach. Grupa musi
    // przejac pozycje swojego najlepszego czlonka, inaczej firma z jednym bardzo
    // trafnym oddzialem spadalaby w dol przez reszte oddzialow.
    it('stawia grupe na pozycji jej pierwszego czlonka', () => {
        const input = [
            location('alfa', 'Warszawa'),
            location('beta', 'Kraków'),
            location('alfa', 'Gdańsk'),
            location('alfa', 'Poznań'),
            location('gamma', 'Łódź'),
        ];

        const rows = groupServicesByCompany(input);

        expect(rows.map(row => (row.kind === 'group' ? row.serviceId : row.service.serviceId))).toEqual([
            'alfa',
            'beta',
            'gamma',
        ]);
    });

    it('nie gubi ani nie dubluje zadnej lokalizacji', () => {
        const input = [
            location('alfa', 'Warszawa'),
            location('beta', 'Kraków'),
            location('alfa', 'Gdańsk'),
            location('alfa', 'Poznań'),
            location('beta', 'Wrocław'),
        ];

        const rows = groupServicesByCompany(input);
        const ids = rows.flatMap(row => (row.kind === 'group' ? row.services : [row.service])).map(s => s.id);

        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.sort()).toEqual(input.map(s => s.id).sort());
    });

    it('liczy miasta bez powtorzen', () => {
        const input = [
            location('alfa', 'Warszawa'),
            location('alfa', 'Warszawa'),
            location('alfa', 'Kraków'),
        ];

        const rows = groupServicesByCompany(input);

        expect(rows[0].kind === 'group' && rows[0].cities).toEqual(['Warszawa', 'Kraków']);
    });

    /**
     * Najwazniejsza regula calej zmiany. Wejsciem jest lista PO filtrowaniu, wiec
     * licznik opisuje to, co uzytkownik zobaczy po rozwinieciu — a nie to, ile
     * firma ma punktow w calej Polsce. Karta "32 punkty" po zawezeniu do Krakowa,
     * gdzie firma ma dwa, byloby klamstwem w miejscu, ktore uzytkownik sprawdzi
     * jednym kliknieciem.
     */
    it('licznik opisuje tylko lokalizacje, ktore przeszly filtr', () => {
        const poFiltrowaniuDoKrakowa = [
            location('ukrainoczka', 'Kraków'),
            location('ukrainoczka', 'Kraków'),
            location('ukrainoczka', 'Kraków'),
        ];

        const rows = groupServicesByCompany(poFiltrowaniuDoKrakowa);

        expect(rows[0].kind === 'group' && rows[0].services).toHaveLength(3);
        expect(rows[0].kind === 'group' && rows[0].cities).toEqual(['Kraków']);
    });

    it('przyjmuje inny prog', () => {
        const input = [location('alfa', 'Warszawa'), location('alfa', 'Kraków')];

        const rows = groupServicesByCompany(input, { threshold: 2 });

        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe('group');
    });

    it('pusta lista daje pusty wynik', () => {
        expect(groupServicesByCompany([])).toEqual([]);
    });
});
