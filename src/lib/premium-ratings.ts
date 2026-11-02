/**
 * Oceny firmy z innych serwisow na stronie premium — stale wspolne dla schematu tresci
 * (`src/db/premium-content-schema.ts`) i widoku. Modul bez importow runtime'owych: czyta go
 * kod kliencki, ktory nie moze wciagac zoda ani `src/db`.
 *
 * Oceny wpisuje operator recznie w bloku `premium` pliku wpisu (z linkiem do zrodla).
 * Automatyczne pobieranie ocen Google przez Places API jest wstrzymane: warunki Google Maps
 * Platform dla klientow z EEA nie obejmuja pokazywania ocen cudzych firm w katalogu i nie
 * pozwalaja cache'owac `rating`/`userRatingCount` (szczegoly w raporcie zadania).
 */

/** Zrodla ocen: serwisy, na ktorych firmy z katalogu realnie zbieraja opinie. */
export const PREMIUM_RATING_SOURCES = [
    'google',
    'booksy',
    'facebook',
    'znanylekarz',
    'fixly',
    'other',
] as const;

export type PremiumRatingSource = (typeof PREMIUM_RATING_SOURCES)[number];

/** Nazwy wlasne serwisow — nie tlumaczy sie ich. `other` bierze nazwe z pola `label`. */
export const PREMIUM_RATING_SOURCE_NAMES: Record<Exclude<PremiumRatingSource, 'other'>, string> = {
    google: 'Google',
    booksy: 'Booksy',
    facebook: 'Facebook',
    znanylekarz: 'ZnanyLekarz',
    fixly: 'Fixly',
};

/** Skala ocen we wszystkich obslugiwanych serwisach. */
export const PREMIUM_RATING_MAX = 5;

/** Gorny limit plakietek: wiecej niz kilka serwisow to szum, nie argument. */
export const PREMIUM_RATINGS_MAX = 6;

export const PREMIUM_RATING_LABEL_MAX_LENGTH = 40;
