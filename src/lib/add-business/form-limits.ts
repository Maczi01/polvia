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

/**
 * Serwisy z kolumny `service_locations.socials` (`src/db/schema.ts`) w kolejnosci formularza:
 * najpierw komunikatory (na karcie to przyciski akcji), potem profile. Pole formularza to
 * `socials.<klucz>`.
 */
export const SOCIAL_KEYS = [
    'whatsapp',
    'telegram',
    'facebook',
    'instagram',
    'tiktok',
    'youtube',
    'threads',
    'linkedin',
    'viber',
    'tripadvisor',
    'x',
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

/** Pokazywane od razu; reszta `SOCIAL_KEYS` pod „Dodaj inne". */
export const PRIMARY_SOCIAL_KEYS = [
    'whatsapp',
    'telegram',
    'facebook',
    'instagram',
] as const satisfies readonly SocialKey[];

/** Linki social media — limit kolumny tekstowej katalogu. */
export const SOCIAL_URL_MAX_LENGTH = 255;

/** Numer WhatsApp: limit kolumny `whatsapp_number` (`varchar(20)`). */
export const WHATSAPP_NUMBER_MAX_LENGTH = 20;

/**
 * Prostokat obejmujacy Polske z zapasem na pas przygraniczny: granica recznie ustawionej
 * pinezki (walidacja w `owner-pin-schema.ts`, `maxBounds` mapy w edytorze).
 */
export const POLAND_BOUNDS = {
    minLat: 49,
    maxLat: 54.9,
    minLng: 14.1,
    maxLng: 24.2,
} as const;
