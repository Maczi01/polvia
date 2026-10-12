/**
 * Wartosci enuma `coverage` (zasieg obslugi) — druga, ortogonalna os obok kategorii.
 *
 * - `local`  — obsluga wylacznie na miejscu; ma pin na mapie
 * - `online` — obsluga wylacznie zdalna, brak punktu obslugi; NIE ma pinu na mapie
 * - `hybrid` — punkt obslugi ORAZ obsluga zdalna; ma pin i wchodzi do wynikow online
 *
 * `schema.ts` buduje z nich `pgEnum`, wiec kolejnosc jest kolejnoscia w bazie — NIE zmieniaj
 * jej. Modul bez importow, zeby walidacja po stronie klienta nie wciagala drizzle `pg-core`.
 */
export const COVERAGE_VALUES = ['local', 'online', 'hybrid'] as const;

export type Coverage = (typeof COVERAGE_VALUES)[number];
