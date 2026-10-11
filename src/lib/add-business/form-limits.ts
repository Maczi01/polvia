/**
 * Stale formularza „Dodaj firme" wspolne dla serwera (schematy Zod, pipeline logo)
 * i komponentow klienckich (atrybuty `maxLength`/`accept`, walidacja przed wysylka).
 *
 * Moduł bez importow runtime'owych — schematy (`zod`) i `sharp` zostaja w swoich modulach,
 * a klient bierze stad wylacznie liczby i listy.
 */

/** Jezyki obslugi klienta — te same kody co locale katalogu (`klasyfikacja.md`). */
export const LANGUAGE_CODES = ['pl', 'uk', 'en', 'ru'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Uwagi wlasciciela dla operatora (krok edycji). */
export const NOTES_MAX_LENGTH = 2000;

/** Opis dzialalnosci w trybie recznym — z niego model pisze klasyfikacje i opisy. */
export const MANUAL_DESCRIPTION_MIN = 50;
export const MANUAL_DESCRIPTION_MAX = 1000;

/** Rozmiar pliku logo przed dekodowaniem. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Formaty logo. Serwer rozpoznaje format z TRESCI pliku (sharp), nie z `file.type` —
 * po stronie klienta lista sluzy tylko do atrybutu `accept` i wczesnego komunikatu.
 */
export const LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
