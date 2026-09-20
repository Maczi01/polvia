import type { PartialService } from '@/types';

/**
 * Sklejanie lokalizacji jednej firmy w jeden wiersz listy.
 *
 * Dwie firmy — Ukrainoczka i Best Market — maja po 32 punkty i same generuja
 * 64 z 272 kart, czyli niemal cwierc listy. Zwiniecie firm wielooddzialowych
 * skraca liste o 44%.
 *
 * WEJSCIEM MUSI BYC LISTA JUZ PRZEFILTROWANA. Grupowanie przed filtrowaniem
 * dawaloby karte "32 punkty" po zawezeniu do Krakowa, gdzie firma ma dwa —
 * licznik klamalby o tym, co uzytkownik zobaczy po kliknieciu.
 */

/**
 * Prog zwijania. Przy dwoch punktach zwijanie dokłada klikniecie, zeby
 * oszczedzic jeden wiersz. Na danych katalogu prog 3 daje 113 ze 121 mozliwych
 * do oszczedzenia wierszy (93%) i zostawia w spokoju osiem firm dwupunktowych.
 */
export const GROUPING_THRESHOLD = 3;

export type ServiceRow =
    | { kind: 'single'; key: string; service: PartialService }
    | {
          kind: 'group';
          key: string;
          serviceId: string;
          name: string;
          /** Lokalizacje, ktore przeszly filtr — nie wszystkie, jakie firma ma. */
          services: PartialService[];
          /** Miasta bez powtorzen, w kolejnosci wystapienia. */
          cities: string[];
      };

interface GroupingOptions {
    threshold?: number;
}

export function groupServicesByCompany(
    services: PartialService[],
    { threshold = GROUPING_THRESHOLD }: GroupingOptions = {},
): ServiceRow[] {
    const byCompany = new Map<string, PartialService[]>();

    for (const service of services) {
        const existing = byCompany.get(service.serviceId);
        if (existing) {
            existing.push(service);
        } else {
            byCompany.set(service.serviceId, [service]);
        }
    }

    const rows: ServiceRow[] = [];
    const emitted = new Set<string>();

    // Iterujemy po WEJSCIU, nie po mapie: grupa ma stanac dokladnie tam, gdzie
    // stal jej pierwszy czlonek. Wejscie jest juz posortowane po trafnosci,
    // promowaniu i klikach, wiec to zachowuje ranking bez liczenia go od nowa.
    for (const service of services) {
        const members = byCompany.get(service.serviceId);
        if (!members) continue;

        if (members.length < threshold) {
            rows.push({ kind: 'single', key: service.id, service });
            continue;
        }

        if (emitted.has(service.serviceId)) continue;
        emitted.add(service.serviceId);

        rows.push({
            kind: 'group',
            key: `group-${service.serviceId}`,
            serviceId: service.serviceId,
            name: service.name,
            services: members,
            cities: [...new Set(members.map(member => member.city).filter(Boolean))] as string[],
        });
    }

    return rows;
}
