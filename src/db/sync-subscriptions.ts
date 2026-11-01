/**
 * Odtwarza stan premium (`service_subscriptions` + `promoted_services`) ze Stripe.
 *
 * Uruchomienie (po `db:reset` albo po awarii webhooka):
 *   npm run db:sync-subscriptions
 *
 * Synchronizuje wszystkie subskrypcje konta ta sama logika co webhook, wiec wynik jest
 * identyczny jak po dostarczeniu zdarzen. Powiazanie z wpisem po `db:reset` (nowe
 * `services.id`) idzie przez `metadata.serviceSlug`. Idempotentne — ponowne uruchomienie
 * niczego nie psuje. Pisze do bazy z `DATABASE_URL`. Szczegoly: `subscription-resync.ts`.
 *
 * Klucz testowy Stripe + baza nielokalna = odmowa startu (exit 1) przed jakimkolwiek zapisem.
 * Brak konfiguracji Stripe (platnosci online wylaczone) = odmowa startu z komunikatem.
 *
 * Wymaga `--conditions=react-server` (moduly `src/lib` maja `import 'server-only'`).
 */

import { inspectDatabaseUrl } from '@/lib/database-host';
import { STRIPE_KEY_MODE } from '@/lib/stripe';

import { env } from '../../env';
import { runSubscriptionResync } from './subscription-resync';

// Skrypt CJS (`node --import tsx`): bez top-level await, wynik przez `process.exit`.
/* eslint-disable no-console, unicorn/no-process-exit, unicorn/prefer-top-level-await */

runSubscriptionResync(inspectDatabaseUrl(env.DATABASE_URL), STRIPE_KEY_MODE)
    .then(exitCode => process.exit(exitCode))
    .catch((error: unknown) => {
        console.error('sync-subscriptions failed:', error);
        process.exit(1);
    });
