import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { stripeEventsTable } from '@/db/schema';

/**
 * Deduplikacja ponowien webhooka Stripe. Zdarzenie oznaczamy dopiero PO udanej
 * synchronizacji: blad synchronizacji zostawia je nieoznaczone, wiec ponowienie przejdzie.
 */
export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
    const [row] = await db
        .select({ id: stripeEventsTable.id })
        .from(stripeEventsTable)
        .where(eq(stripeEventsTable.id, eventId))
        .limit(1);

    return row !== undefined;
}

/**
 * `true`, gdy to wywolanie oznaczylo zdarzenie; `false`, gdy rownolegle dostarczenie
 * tego samego zdarzenia zrobilo to pierwsze (wtedy skutki uboczne pomijamy).
 */
export async function markStripeEventProcessed(event: {
    id: string;
    type: string;
}): Promise<boolean> {
    const inserted = await db
        .insert(stripeEventsTable)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ id: stripeEventsTable.id });

    return inserted.length > 0;
}
