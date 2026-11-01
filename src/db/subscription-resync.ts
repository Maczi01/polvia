/**
 * Logika `npm run db:sync-subscriptions` (wejscie: `sync-subscriptions.ts`), wydzielona,
 * zeby dalo sie ja testowac bez uruchamiania skryptu i `process.exit`.
 *
 * Listuje WSZYSTKIE subskrypcje konta Stripe (`status: 'all'`) i kazda synchronizuje ta sama
 * logika co webhook (`syncSubscriptionSnapshot`) — z obiektu z listy, bez drugiego `retrieve`.
 * Obiekt z listy moze byc o sekundy starszy od rownoleglego zdarzenia webhooka; stan
 * koncowy chroni `decideSubscriptionWrite`, a reszte poprawia kolejne zdarzenie (jak przy
 * webhooku).
 *
 * Kolejnosc: od NAJSTARSZEJ subskrypcji. Przy dwoch subskrypcjach jednego wpisu wiaze sie
 * pierwsza, a druga konczy sie konfliktem — regula i jej jedyny rozjazd z webhookiem opisane
 * przy `decideSubscriptionWrite`. Konflikty tylko w logu: mail wysyla wylacznie webhook.
 */

import type Stripe from 'stripe';

import type { DatabaseHost } from '@/lib/database-host';
import { stripe } from '@/lib/stripe';
import { type SubscriptionSyncResult, syncSubscriptionSnapshot } from '@/lib/subscription-sync';

/* eslint-disable no-console */

export type ResyncOutcome = SubscriptionSyncResult['outcome'] | 'failed';

export type ResyncSummary = Record<ResyncOutcome, number>;

/**
 * Klucz testowy Stripe + baza nielokalna: testowa subskrypcja (karta 4242) dalaby prawdziwemu
 * wpisowi premium. Komunikat dla czlowieka przy terminalu albo `null`, gdy wolno startowac.
 * Wzorem `assertDropAllowed` (`drop.ts`). Host i lokalnosc z jednego parsowania adresu.
 */
export function keyModeRefusal(database: DatabaseHost, isLiveKey: boolean): string | null {
    if (isLiveKey || database.isLocal) return null;

    return (
        `\n⛔ ODMOWA: klucz Stripe jest TESTOWY, a DATABASE_URL nie wskazuje na localhost.\n\n` +
        `   host: ${database.hostname ?? '(nieznany)'}\n\n` +
        '   Testowe subskrypcje nadalyby premium prawdziwym wpisom w tej bazie.\n' +
        '   Uzyj klucza sk_live_ albo lokalnej bazy z docker-compose (port 5433).\n'
    );
}

async function listSubscriptionsOldestFirst(): Promise<Stripe.Subscription[]> {
    const subscriptions: Stripe.Subscription[] = [];
    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
        subscriptions.push(subscription);
    }
    return subscriptions.sort((a, b) => a.created - b.created);
}

function describeResult(result: SubscriptionSyncResult): string {
    // Konflikt z identyfikatorem subskrypcji, ktora wpis zachowal — do decyzji o zwrocie.
    if (result.outcome === 'conflict') {
        const paid = result.isIncomingActive ? ', oplacona — do zwrotu' : '';
        return `conflict (wpis ma ${result.activeSubscriptionId}${paid})`;
    }
    return result.outcome;
}

/** Synchronizuje kolejno (limit zapytan Stripe, czytelny log, kolejnosc od najstarszej). */
export async function resyncAllSubscriptions(): Promise<ResyncSummary> {
    const summary: ResyncSummary = {
        synced: 0,
        stale_ignored: 0,
        conflict: 0,
        unlinked: 0,
        service_missing: 0,
        failed: 0,
    };

    for (const subscription of await listSubscriptionsOldestFirst()) {
        try {
            const result = await syncSubscriptionSnapshot(subscription);
            summary[result.outcome] += 1;
            console.log(`${subscription.id}: ${describeResult(result)}`);
        } catch (error) {
            summary.failed += 1;
            console.error(`${subscription.id}: failed`, error);
        }
    }

    return summary;
}

/** Caly przebieg skryptu; zwraca kod wyjscia procesu. */
export async function runSubscriptionResync(
    database: DatabaseHost,
    isLiveKey: boolean,
): Promise<number> {
    const refusal = keyModeRefusal(database, isLiveKey);
    if (refusal) {
        console.error(refusal);
        return 1;
    }

    // Sam host, bez loginu i hasla.
    const host = database.hostname ?? '(nieznany)';
    console.log(`Tryb klucza Stripe: ${isLiveKey ? 'LIVE' : 'TEST'}, baza: ${host}`);

    const summary = await resyncAllSubscriptions();
    console.log('Podsumowanie:', summary);
    return summary.failed > 0 ? 1 : 0;
}
