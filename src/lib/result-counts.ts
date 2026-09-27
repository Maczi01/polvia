import { CATEGORIES } from '@/lib/categories';
import { groupServicesByCompany } from '@/lib/group-services-by-company';
import { type CoverageFilters, splitServicesByCoverage } from '@/lib/service-coverage';
import type { PartialService } from '@/types';

/**
 * Liczby wynikow pokazywane przy filtrach.
 *
 * Liczymy KARTY, nie lokalizacje: firma z osmioma punktami to na liscie jedna
 * zwinieta karta, wiec licznik "(8)" klamalby o tym, co uzytkownik zobaczy.
 * Definicja karty pochodzi z `groupServicesByCompany` — tej samej funkcji, ktora
 * buduje liste w `map-list-rows.ts`.
 */

/** Liczba kart, jaka lista pokaze dla juz przefiltrowanej sekcji. */
export function countListCards(services: PartialService[]): number {
    return groupServicesByCompany(services).length;
}

/**
 * Liczba kart dla kazdej kategorii przy POZOSTALYCH aktywnych filtrach.
 *
 * Aktywna kategoria jest podmieniana na liczona, reszta filtrow (miasto,
 * wojewodztwo, tekst, "Online") zostaje. Sekcje lokalna i online sa liczone
 * osobno, bo lista grupuje je osobno. Wyniki semantyczne nie wchodza — to
 * podpowiedzi doładowywane po wpisaniu tekstu, nie efekt filtra.
 */
export function countCardsByCategory(
    services: PartialService[],
    filters: CoverageFilters,
): Record<string, number> {
    return Object.fromEntries(
        CATEGORIES.map(({ key }) => {
            const { localResults, onlineResults } = splitServicesByCoverage(services, {
                ...filters,
                category: key,
            });
            return [key, countListCards(localResults) + countListCards(onlineResults)];
        }),
    );
}
