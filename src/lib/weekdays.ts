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

/** Godziny jednego dnia, np. `{ open: '08:00', close: '18:00' }`. */
export type OpeningPeriod = { open: string; close: string };

/**
 * Ksztalt kolumny `service_locations.opening_hours`: klucze z `WEEKDAY_KEYS`, dzien
 * bez wpisu jest zamkniety. Jedno zrodlo dla schematu, profilu, karty i JSON-LD.
 */
export type OpeningHours = Record<string, OpeningPeriod>;
