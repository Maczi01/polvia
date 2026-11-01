import { isValidServiceSlug } from '../lib/service-slug-format';
import {
    assignMissingServiceSlugs,
    createServiceSlugAllocator,
    planNewServiceSlug,
    serviceSlugBase,
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

    it('nazwa bez liter i cyfr dostaje zastepcza baze zamiast pustego slugu', () => {
        // Baza `firma` jest segmentem zarezerwowanym (`/firma/<slug>`), wiec od razu sufiks.
        expect(assignMissingServiceSlugs([candidate({ id: 'a', name: '!!!' })])).toEqual([
            { id: 'a', slug: 'firma-2' },
        ]);
    });

    it('nie rusza istniejacego slugu rownego segmentowi zarezerwowanemu', () => {
        expect(assignMissingServiceSlugs([candidate({ id: 'a', name: 'Blog', slug: 'blog' })])).toEqual(
            [],
        );
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
    it.each([
        ['Blog', 'blog-2'],
        ['Mapa', 'mapa-2'],
        ['Cennik', 'cennik-2'],
        ['WP Admin', 'wp-admin-2'],
        ['API', 'api-2'],
    ])('nazwa %s kolidujaca z segmentem zarezerwowanym dostaje sufiks: %s', (name, expected) => {
        expect(createServiceSlugAllocator()(name)).toBe(expected);
    });

    it('slug z prefiksem api nie jest zarezerwowany — matcher wyklucza tylko /api/**', () => {
        expect(createServiceSlugAllocator()('Apiary')).toBe('apiary');
    });

    it('sufiks po segmencie zarezerwowanym omija takze slugi juz zajete', () => {
        expect(createServiceSlugAllocator(['blog-2'])('Blog')).toBe('blog-3');
    });
});

describe('planNewServiceSlug', () => {
    const FREE = { takenServiceSlugs: [], takenLocationSlugs: [] };

    it('wolna nazwa daje slug z nazwy, niezaleznie od bazy slugow lokalizacji z JSON', () => {
        // np. data/services: name "Ifiora", slug (baza lokalizacji) "ifiora-warszawa"
        expect(planNewServiceSlug({ ...FREE, name: 'Ifiora' })).toEqual({
            ok: true,
            serviceSlug: 'ifiora',
        });
    });

    it('zajety slug z nazwy dostaje pierwszy wolny sufiks, jak w seedzie i backfillu', () => {
        const plan = planNewServiceSlug({
            ...FREE,
            name: 'Kwiaciarnia Roza',
            takenServiceSlugs: ['kwiaciarnia-roza', 'kwiaciarnia-roza-2'],
        });

        expect(plan).toEqual({ ok: true, serviceSlug: 'kwiaciarnia-roza-3' });
    });

    it('nazwa bez znakow [a-z0-9] dostaje zastepczy slug, takze przy kolizji', () => {
        expect(planNewServiceSlug({ ...FREE, name: '!!!', takenServiceSlugs: ['firma'] })).toEqual(
            { ok: true, serviceSlug: 'firma-2' },
        );
    });

    it('zajety slug lokalizacji przerywa z lista kolizji (duplikat wpisu)', () => {
        const plan = planNewServiceSlug({
            ...FREE,
            name: 'Ifiora',
            takenLocationSlugs: ['ifiora-warszawa', 'ifiora-krakow'],
        });

        expect(plan.ok).toBe(false);
        if (plan.ok) return;
        expect(plan.message).toContain(
            'slug lokalizacji juz istnieje w bazie: ifiora-warszawa, ifiora-krakow',
        );
    });

    it.each(['Żłobek Słoneczko', 'Привіт Їжак', '- Studio -', '😀', '中文'])(
        'slug dla %s ma format, ktory przepusci middleware',
        name => {
            const plan = planNewServiceSlug({ ...FREE, name });

            expect(plan.ok && isValidServiceSlug(plan.serviceSlug)).toBe(true);
        },
    );
});

describe('serviceSlugBase', () => {
    it('to slug z nazwy albo zastepczy, gdy nazwa nie daje znakow', () => {
        expect(serviceSlugBase('Multi Cook')).toBe('multi-cook');
        expect(serviceSlugBase('!!!')).toBe('firma');
    });
});
