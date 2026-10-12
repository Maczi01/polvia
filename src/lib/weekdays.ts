/**
 * Klucze godzin otwarcia, w kolejnosci wyswietlania.
 *
 * Moduł bez importow runtime'owych: czytaja go i schemat wpisu (`service-input-schema.ts`),
 * i komponenty klienckie formularza „Dodaj firme" — te nie moga wciagac zoda ani `slugify`.
 */
export const WEEKDAY_KEYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
] as const;

export type Weekday = (typeof WEEKDAY_KEYS)[number];
