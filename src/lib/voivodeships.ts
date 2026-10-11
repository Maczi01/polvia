/**
 * Wartosci enuma `voivodeship` w Postgresie — `schema.ts` buduje z nich `pgEnum`.
 * Kolejnosc jest kolejnoscia w bazie, NIE zmieniaj jej.
 *
 * Modul bez importow, zeby walidacja po stronie klienta nie wciagala drizzle `pg-core`.
 */
export const VOIVODESHIP_VALUES = [
    'dolnoslaskie',
    'kujawsko-pomorskie',
    'lubelskie',
    'lubuskie',
    'lodzkie',
    'malopolskie',
    'mazowieckie',
    'opolskie',
    'podkarpackie',
    'podlaskie',
    'pomorskie',
    'slaskie',
    'swietokrzyskie',
    'warminsko-mazurskie',
    'wielkopolskie',
    'zachodniopomorskie',
] as const;

export type Voivodeship = (typeof VOIVODESHIP_VALUES)[number];
