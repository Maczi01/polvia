/**
 * Klucze `subscription.metadata`, ktore ustawia checkout premium (U9) i czyta synchronizacja.
 * Slug przezywa `db:reset` (nowe `services.id`), wiec jest glownym kluczem resyncu.
 *
 * Modul bez zaleznosci: importuje go checkout, a nie powinien wciagac przez to synchronizacji,
 * adaptera bazy ani mailera.
 */
export const SUBSCRIPTION_METADATA_KEYS = {
    serviceId: 'serviceId',
    serviceSlug: 'serviceSlug',
} as const;
