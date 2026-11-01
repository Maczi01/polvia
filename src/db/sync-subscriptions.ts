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
 * Kolejnosc: od NAJSTARSZEJ subskrypcji. Przy dwoch subskrypcjach jednego wpisu wiaze
 * sie pierwsza (ta, ktora wpis ma zachowac), a druga konczy sie konfliktem — tak jak przy
 * zdarzeniach webhooka. Konflikty tylko w logu: mail o konflikcie wysyla wylacznie webhook.
 *
 * Klucz testowy Stripe + baza nielokalna = odmowa startu (exit 1) przed jakimkolwiek zapisem:
 * testowa subskrypcja (karta 4242) dalaby prawdziwemu wpisowi premium.
 *
 * Wymaga `--conditions=react-server` (moduly `src/lib` maja `import 'server-only'`).
 */

import type Stripe from 'stripe';

import { databaseHostname, isLocalDatabaseUrl } from '@/lib/database-host';
import { stripe, STRIPE_LIVE_MODE } from '@/lib/stripe';
import { type SubscriptionSyncResult, syncSubscriptionFromStripe } from '@/lib/subscription-sync';

import { env } from '../../env';

/* eslint-disable no-console, unicorn/no-process-exit */

type Outcome = SubscriptionSyncResult['outcome'] | 'failed';

/** Wzorem `assertDropAllowed` (`drop.ts`): czytelny komunikat dla czlowieka, nie stack trace. */
function assertKeyModeMatchesDatabase(host: string): void {
    if (STRIPE_LIVE_MODE || isLocalDatabaseUrl(env.DATABASE_URL)) return;

    console.error(
        `\n⛔ ODMOWA: klucz Stripe jest TESTOWY, a DATABASE_URL nie wskazuje na localhost.\n\n` +
            `   host: ${host}\n\n` +
            '   Testowe subskrypcje nadalyby premium prawdziwym wpisom w tej bazie.\n' +
            '   Uzyj klucza sk_live_ albo lokalnej bazy z docker-compose (port 5433).\n',
    );
    process.exit(1);
}

async function listSubscriptionsOldestFirst(): Promise<Stripe.Subscription[]> {
    const subscriptions: Stripe.Subscription[] = [];
    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
        subscriptions.push(subscription);
    }
    return subscriptions.sort((a, b) => a.created - b.created);
}

async function main(): Promise<void> {
    // Sam host, bez loginu i hasla.
    const host = databaseHostname(env.DATABASE_URL) ?? '(nieznany)';
    assertKeyModeMatchesDatabase(host);
    console.log(`Tryb klucza Stripe: ${STRIPE_LIVE_MODE ? 'LIVE' : 'TEST'}, baza: ${host}`);

    const counts: Record<Outcome, number> = {
        synced: 0,
        conflict: 0,
        unlinked: 0,
        service_missing: 0,
        failed: 0,
    };

    // Kolejno, nie rownolegle: limit zapytan Stripe, czytelny log i kolejnosc od najstarszej.
    for (const subscription of await listSubscriptionsOldestFirst()) {
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
