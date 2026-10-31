/**
 * Format slugu uslugi (adres `/firma/<slug>`) — jedno zrodlo dla walidacji pliku wpisu (zod)
 * i dla middleware (edge). Modul bez importow: middleware nie moze wciagac zoda ani drizzle.
 */

/** Dlugosc kolumny `services.slug` (`varchar(255)`). */
export const MAX_SERVICE_SLUG_LENGTH = 255;

/**
 * Format `slugify(name, { lower: true, strict: true })`: grupy `[a-z0-9]` laczone pojedynczym
 * myslnikiem, bez myslnika na brzegach. Slug spoza tego formatu middleware odrzuca jako 404.
 */
export const SERVICE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Czy tekst ma format slugu uslugi. Nie mowi, czy wpis istnieje. */
export function isValidServiceSlug(slug: string): boolean {
    return slug.length <= MAX_SERVICE_SLUG_LENGTH && SERVICE_SLUG_PATTERN.test(slug);
}
