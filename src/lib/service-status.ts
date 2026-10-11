/**
 * Wartosci enuma `status` wpisu w Postgresie — `schema.ts` buduje z nich `pgEnum`.
 * Kolejnosc jest kolejnoscia w bazie, NIE zmieniaj jej.
 *
 * Modul bez importow, zeby `service-input-schema.ts` nie wciagal drizzle `pg-core`.
 */
export const SERVICE_STATUS_VALUES = ['active', 'inactive', 'pending', 'confirmed'] as const;

export type ServiceStatus = (typeof SERVICE_STATUS_VALUES)[number];
