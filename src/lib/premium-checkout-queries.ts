import 'server-only';

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { serviceProfilesTable, servicesTable, serviceSubscriptionsTable } from '@/db/schema';
import { hasActivePremium } from '@/lib/premium';
import { isPublicService } from '@/lib/public-service-filter';
import {
    manualPremiumUntilColumn,
    serviceProfileJoin,
    subscriptionColumns,
    subscriptionJoin,
} from '@/lib/subscription-query-parts';

/** Wpis, dla ktorego mozna kupic premium: aktywny i z adresem profilu. */
export type PremiumCheckoutTarget = {
    serviceId: string;
    slug: string;
    /** Nazwa bazowa (`services.name`) — do maila foundera, nie do UI. */
    name: string;
    /** `hasActivePremium` (subskrypcja albo premium reczne) w chwili zapytania. */
    hasActivePremium: boolean;
};

/**
 * Wpis po `id` dla checkoutu i weryfikacji sesji. `null`, gdy wpis nie istnieje, nie jest
 * aktywny albo nie ma slugu (bez slugu nie ma profilu ani metadanych do resyncu).
 * Joiny subskrypcji i tresci te same co w profilu: wylacznie po `service_id` tego wpisu.
 */
export async function getPremiumCheckoutTarget(
    serviceId: string,
    now: Date = new Date(),
): Promise<PremiumCheckoutTarget | null> {
    const [row] = await db
        .select({
            id: servicesTable.id,
            slug: servicesTable.slug,
            name: servicesTable.name,
            subscription: subscriptionColumns,
            manualPremiumUntil: manualPremiumUntilColumn,
        })
        .from(servicesTable)
        .leftJoin(serviceSubscriptionsTable, subscriptionJoin)
        .leftJoin(serviceProfilesTable, serviceProfileJoin)
        .where(and(eq(servicesTable.id, serviceId), isPublicService))
        .limit(1);

    if (!row || row.slug === null) return null;

    return {
        serviceId: row.id,
        slug: row.slug,
        name: row.name,
        hasActivePremium: hasActivePremium(row, now),
    };
}
