import { buildServiceSlug } from './service-input-schema';

/**
 * Czysta logika slugow uslug (adres `/firma/<slug>`), wydzielona z
 * `backfill-service-slugs.ts` i `add-service.ts`, bo oba importuja `./index`
 * (polaczenie z baza przy ladowaniu modulu) i nie da sie ich zaimportowac w tescie.
 */

/** Baza slugu, gdy nazwa nie daje ani jednego znaku `[a-z0-9]` (np. same emoji). */
const FALLBACK_SLUG_BASE = 'firma';

/** Pierwszy sufiks przy kolizji: `nazwa`, `nazwa-2`, `nazwa-3`… */
const FIRST_COLLISION_SUFFIX = 2;

export type SlugCandidate = {
    id: string;
    name: string;
    slug: string | null;
    createdAt: Date;
};

export type SlugAssignment = {
    id: string;
    slug: string;
};

/**
 * Baza slugu uslugi: `buildServiceSlug(name)`, a gdy nazwa nie daje znakow — `firma`.
 * Kolizje dostaja sufiksy `<baza>-2`, `<baza>-3`…, wiec zajete slugi do sprawdzenia
 * to `<baza>` i `<baza>-*`.
 */
export function serviceSlugBase(name: string): string {
    return buildServiceSlug(name) || FALLBACK_SLUG_BASE;
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
    if (!taken.has(base)) return base;

    let suffix = FIRST_COLLISION_SUFFIX;
    while (taken.has(`${base}-${suffix}`)) suffix += 1;

    return `${base}-${suffix}`;
}

/**
 * Przydzielacz slugow uslug: `buildServiceSlug(name)`, a przy kolizji z juz
 * przydzielonym albo zajetym slugiem sufiks `-2`, `-3`… w kolejnosci wywolan.
 * Wspolny rdzen backfillu (kolejnosc `createdAt`) i seeda (kolejnosc wstawiania),
 * zeby po `db:reset` wpis mial ten sam adres `/firma/<slug>` co na produkcji.
 */
export function createServiceSlugAllocator(
    takenSlugs: Iterable<string> = [],
): (name: string) => string {
    const taken = new Set(takenSlugs);

    return name => {
        const slug = uniqueSlug(serviceSlugBase(name), taken);
        taken.add(slug);
        return slug;
    };
}

/**
 * Slugi dla uslug, ktore jeszcze go nie maja. Wiersze ze slugiem zostaja
 * nietkniete (slug jest niezmienny), wiec ponowne uruchomienie nic nie zmienia.
 *
 * Kolejnosc przydzialu po `createdAt` (remis: `id`): starszy wpis dostaje
 * `nazwa`, mlodszy `nazwa-2` — wynik nie zalezy od kolejnosci wierszy z bazy.
 */
export function assignMissingServiceSlugs(services: readonly SlugCandidate[]): SlugAssignment[] {
    const allocate = createServiceSlugAllocator(
        services.flatMap(service => (service.slug === null ? [] : [service.slug])),
    );

    const pending = services
        .filter(service => service.slug === null)
        .toSorted(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
        );

    return pending.map(service => ({ id: service.id, slug: allocate(service.name) }));
}

export type NewServiceSlugInput = {
    /** `name` z pliku wpisu — jedyne zrodlo slugu uslugi. */
    name: string;
    /** Slugi uslug juz zajete w bazie (wystarcza `<baza>` i `<baza>-*`). */
    takenServiceSlugs: Iterable<string>;
    /** Slugi lokalizacji nowego wpisu, ktore juz istnieja w bazie. */
    takenLocationSlugs: readonly string[];
};

export type NewServiceSlugPlan = { ok: true; serviceSlug: string } | { ok: false; message: string };

/**
 * Slug uslugi dla `db:add`: ta sama regula co seed i backfill (`createServiceSlugAllocator`
 * zasilony zajetymi slugami), wiec wpis ma ten sam adres `/firma/<slug>` po `db:add`
 * i po `db:reset`. Zajety slug uslugi nie jest bledem — dostaje sufiks `-2`, `-3`….
 *
 * Bledem jest zajety slug lokalizacji: lokalizacje licza sie z jawnej bazy (`slug` w JSON),
 * wiec kolizja oznacza duplikat wpisu albo baze do zmiany.
 */
export function planNewServiceSlug({
    name,
    takenServiceSlugs,
    takenLocationSlugs,
}: NewServiceSlugInput): NewServiceSlugPlan {
    if (takenLocationSlugs.length > 0) {
        return {
            ok: false,
            message:
                `slug lokalizacji juz istnieje w bazie: ${takenLocationSlugs.join(', ')} ` +
                '— to duplikat wpisu albo ustaw w JSON inny "slug" (baze slugow lokalizacji)',
        };
    }

    return { ok: true, serviceSlug: createServiceSlugAllocator(takenServiceSlugs)(name) };
}
