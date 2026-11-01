/**
 * Szablony strony premium i limity jej tresci.
 *
 * Modul bez importow runtime'owych: czytaja go komponenty klienckie profilu (galeria)
 * oraz przyszly schemat tresci premium — klient nie moze wciagac zoda ani `src/db`.
 */
export const PREMIUM_TEMPLATES = ['gallery', 'professional', 'classic'] as const;

export type PremiumTemplate = (typeof PREMIUM_TEMPLATES)[number];

/** Punkt odniesienia z `monetyzacja.md` (R8). */
export const PREMIUM_GALLERY_MAX = 15;

/** Gorne limity pozycji: chronia strone (i zapis jsonb) przed lista bez konca. */
export const PREMIUM_PRICE_LIST_MAX = 30;

export const PREMIUM_FAQ_MAX = 20;
