import 'server-only';

import { eq } from 'drizzle-orm';

import { servicesTable, serviceSubscriptionsTable } from '@/db/schema';

/**
 * Wspolne fragmenty zapytan o stan subskrypcji wpisu — jedno zrodlo kolumn dla profilu,
 * lookupu slugu, checkoutu i adaptera synchronizacji.
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
