import {
    assignMissingServiceSlugs,
    createServiceSlugAllocator,
    describeSlugConflicts,
    type SlugCandidate,
} from './service-slugs';

function candidate(overrides: Partial<SlugCandidate> & Pick<SlugCandidate, 'id'>): SlugCandidate {
    return {
        name: 'Kwiaciarnia Roza',
        slug: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        ...overrides,
    };
}

describe('assignMissingServiceSlugs', () => {
    it('dwie uslugi o tej samej nazwie dostaja `nazwa` i `nazwa-2` wedlug daty dodania', () => {
        const younger = candidate({ id: 'b', createdAt: new Date('2025-03-01T00:00:00Z') });
        const older = candidate({ id: 'a', createdAt: new Date('2025-02-01T00:00:00Z') });

        const assignments = assignMissingServiceSlugs([younger, older]);

        expect(assignments).toEqual([
            { id: 'a', slug: 'kwiaciarnia-roza' },
            { id: 'b', slug: 'kwiaciarnia-roza-2' },
        ]);
    });

    it('ponowny run po zapisie niczego nie zmienia', () => {
        const services = [candidate({ id: 'a' }), candidate({ id: 'b' })];
        const assigned = assignMissingServiceSlugs(services);
        const slugById = new Map(assigned.map(({ id, slug }) => [id, slug]));
        const afterBackfill = services.map(service => ({
            ...service,
            slug: slugById.get(service.id) ?? null,
        }));

        expect(assignMissingServiceSlugs(afterBackfill)).toEqual([]);
    });

    it('nie rusza istniejacego slugu i omija go przy przydziale nowych', () => {
        const services = [
            candidate({ id: 'stary', slug: 'kwiaciarnia-roza' }),
            candidate({ id: 'nowy' }),
        ];

        expect(assignMissingServiceSlugs(services)).toEqual([
            { id: 'nowy', slug: 'kwiaciarnia-roza-2' },
        ]);
    });

    it('omija sufiks zajety przez inna firme o nazwie konczacej sie liczba', () => {
        const services = [
            candidate({ id: 'a', name: 'Studio 2', slug: 'studio-2' }),
            candidate({ id: 'b', name: 'Studio', slug: 'studio' }),
            candidate({ id: 'c', name: 'Studio' }),
        ];

        expect(assignMissingServiceSlugs(services)).toEqual([{ id: 'c', slug: 'studio-3' }]);
    });

    it('nazwa bez liter i cyfr dostaje bazowy slug zamiast pustego', () => {
        expect(assignMissingServiceSlugs([candidate({ id: 'a', name: '!!!' })])).toEqual([
            { id: 'a', slug: 'firma' },
        ]);
    });
});

describe('createServiceSlugAllocator', () => {
    it('slug z seeda liczy z nazwy, bez sufiksu miasta z bazy slugow lokalizacji', () => {
        const allocate = createServiceSlugAllocator();

        // seed.ts: name 'Multi Cook', slug lokalizacji 'multi-cook-warszawa'
        expect(allocate('Multi Cook')).toBe('multi-cook');
        expect(allocate('Smak Ukraiński')).toBe('smak-ukrainski');
    });

    it('daje ten sam slug co backfill i numeruje duplikaty w kolejnosci wywolan', () => {
        const allocate = createServiceSlugAllocator();
        const backfill = assignMissingServiceSlugs([
            candidate({ id: 'a', name: 'Kozaczok', createdAt: new Date('2025-01-01T00:00:00Z') }),
            candidate({ id: 'b', name: 'Kozaczok', createdAt: new Date('2025-01-02T00:00:00Z') }),
        ]);

        expect([allocate('Kozaczok'), allocate('Kozaczok')]).toEqual(
            backfill.map(({ slug }) => slug),
        );
    });
});

describe('describeSlugConflicts', () => {
    it('zwraca null, gdy wszystkie slugi sa wolne', () => {
        expect(
            describeSlugConflicts({
                serviceSlug: 'ifiora',
                isServiceSlugTaken: false,
                takenLocationSlugs: [],
            }),
        ).toBeNull();
    });

    it('zajety slug uslugi daje komunikat z nazwa slugu i wskazowka', () => {
        const message = describeSlugConflicts({
            serviceSlug: 'ifiora',
            isServiceSlugTaken: true,
            takenLocationSlugs: [],
        });

        expect(message).toBe(
            'slug uslugi "ifiora" jest juz zajety — to duplikat wpisu albo ustaw w JSON inny "slug"',
        );
    });

    it('wymienia zajete slugi lokalizacji obok zajetego slugu uslugi', () => {
        const message = describeSlugConflicts({
            serviceSlug: 'ifiora',
            isServiceSlugTaken: true,
            takenLocationSlugs: ['ifiora-warszawa'],
        });

        expect(message).toContain('slug uslugi "ifiora"');
        expect(message).toContain('slug lokalizacji juz istnieje w bazie: ifiora-warszawa');
    });
});
