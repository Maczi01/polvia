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
        const slug = uniqueSlug(buildServiceSlug(name) || FALLBACK_SLUG_BASE, taken);
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

export type SlugConflicts = {
    serviceSlug: string;
    isServiceSlugTaken: boolean;
    takenLocationSlugs: readonly string[];
};

/**
 * Czytelny opis kolizji slugow wpisu z `data/services/*.json` albo `null`, gdy
 * wszystkie sa wolne. Zajety slug uslugi przerywa dodawanie: cicha zmiana na
 * `-2` dalaby firmie inny adres niz ten, ktory wpisano w JSON.
 */
export function describeSlugConflicts(conflicts: SlugConflicts): string | null {
    const problems: string[] = [];

    if (conflicts.isServiceSlugTaken) {
        problems.push(
            `slug uslugi "${conflicts.serviceSlug}" jest juz zajety — to duplikat wpisu ` +
                'albo ustaw w JSON inny "slug"',
        );
    }

    if (conflicts.takenLocationSlugs.length > 0) {
        problems.push(
            `slug lokalizacji juz istnieje w bazie: ${conflicts.takenLocationSlugs.join(', ')} ` +
                '— to duplikat wpisu',
        );
    }

    return problems.length > 0 ? problems.join('; ') : null;
}
