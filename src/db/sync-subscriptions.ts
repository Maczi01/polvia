/**
 * Odtwarza stan premium (`service_subscriptions` + `promoted_services`) ze Stripe.
 *
 * Uruchomienie (po `db:reset` albo po awarii webhooka):
 *   npm run db:sync-subscriptions
 *
 * Listuje WSZYSTKIE subskrypcje konta Stripe (`status: 'all'`) i dla kazdej wola te sama
 * synchronizacje co webhook, wiec wynik jest identyczny jak po dostarczeniu zdarzen.
 * Powiazanie z wpisem po `db:reset` (nowe `services.id`) idzie przez `metadata.serviceSlug`.
 * Idempotentne — ponowne uruchomienie niczego nie psuje. Pisze do bazy z `DATABASE_URL`.
 *
 * Wymaga `--conditions=react-server` (moduly `src/lib` maja `import 'server-only'`).
 */

import { stripe } from '@/lib/stripe';
import { type SubscriptionSyncResult, syncSubscriptionFromStripe } from '@/lib/subscription-sync';

/* eslint-disable no-console, unicorn/no-process-exit */

type Outcome = SubscriptionSyncResult['outcome'] | 'failed';

async function main(): Promise<void> {
    const counts: Record<Outcome, number> = {
        synced: 0,
        conflict: 0,
        unlinked: 0,
        service_missing: 0,
        failed: 0,
    };

    // Kolejno, nie rownolegle: limit zapytan Stripe i czytelny log.
    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
        try {
            const result = await syncSubscriptionFromStripe(subscription.id);
            counts[result.outcome] += 1;
            console.log(`${subscription.id}: ${result.outcome}`);
        } catch (error) {
            counts.failed += 1;
            console.error(`${subscription.id}: failed`, error);
        }
    }

    console.log('Podsumowanie:', counts);
    if (counts.failed > 0) process.exit(1);
    process.exit(0);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('sync-subscriptions failed:', error);
    process.exit(1);
});
