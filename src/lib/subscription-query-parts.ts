import 'server-only';

import { eq } from 'drizzle-orm';

import { serviceProfilesTable, servicesTable, serviceSubscriptionsTable } from '@/db/schema';

/**
 * Wspolne fragmenty zapytan o stan premium wpisu — jedno zrodlo kolumn dla profilu,
 * lookupu slugu, checkoutu i adaptera synchronizacji. Premium firmy = `hasActivePremium`
 * z subskrypcji (`subscriptionColumns`) i daty premium recznego (`manualPremiumUntilColumn`).
 */

/**
 * Stan subskrypcji przy left joinie: obiekt, ktory Drizzle zamienia na `null`, gdy wpis
 * nie ma wiersza `service_subscriptions`. Ksztalt = wejscie `isPremiumActive`.
 */
export const subscriptionColumns = {
    status: serviceSubscriptionsTable.status,
    currentPeriodStart: serviceSubscriptionsTable.currentPeriodStart,
    currentPeriodEnd: serviceSubscriptionsTable.currentPeriodEnd,
    cancelAtPeriodEnd: serviceSubscriptionsTable.cancelAtPeriodEnd,
};

/**
 * Join subskrypcji WYLACZNIE po `service_id` tego wpisu — subskrypcja innej uslugi nie moze
 * wlaczyc premium. Wspolny dla profilu, lookupu i checkoutu, zeby warunek byl jeden.
 */
export const subscriptionJoin = eq(serviceSubscriptionsTable.serviceId, servicesTable.id);

/**
 * Data premium recznego (`service_profiles.manual_premium_until`) przy left joinie
 * `serviceProfileJoin`: `null`, gdy wpis nie ma wiersza tresci albo daty.
 */
export const manualPremiumUntilColumn = serviceProfilesTable.manualPremiumUntil;

/**
 * Join tresci premium WYLACZNIE po `service_id` tego wpisu — data premium recznego innej
 * uslugi nie moze wlaczyc premium temu wpisowi (jak `subscriptionJoin`).
 */
export const serviceProfileJoin = eq(serviceProfilesTable.serviceId, servicesTable.id);
