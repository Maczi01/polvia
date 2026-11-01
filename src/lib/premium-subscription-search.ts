import 'server-only';

import type Stripe from 'stripe';

import { getStripe } from '@/lib/stripe';
import { SUBSCRIPTION_METADATA_KEYS } from '@/lib/subscription-metadata';
import { TimeoutError, withTimeout } from '@/lib/with-timeout';

/**
 * Statusy subskrypcji, przy ktorych drugi Checkout dla tego samego wpisu to podwojna oplata.
 * `past_due` nie blokuje tutaj — w karencji blokuje go juz `hasActivePremium` z bazy,
 * a po karencji wlasciciel moze kupic ponownie.
 */
const BLOCKING_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
    'active',
    'trialing',
]);

/** Search to dodatkowa bramka — nie moze zjesc budzetu akcji ani zablokowac sprzedazy. */
export const SUBSCRIPTION_SEARCH_TIMEOUT_MS = 3000;

/** Jeden wpis ma najwyzej kilka subskrypcji (zakupy po anulowaniu) — 10 to zapas. */
const SEARCH_LIMIT = 10;

/**
 * Czy wpis ma w Stripe oplacona subskrypcje, ktorej webhook jeszcze nie zapisal: okno
 * miedzy platnoscia a webhookiem, w ktorym druga karta dalaby druga pobrana platnosc
 * i reczny zwrot. Szuka po `metadata['serviceId']`, ktore `createPremiumCheckoutSession`
 * ustawia w `subscription_data.metadata`.
 *
 * Awaria albo przekroczony czas: `false` z logiem — sprzedazy nie blokujemy, a konflikt
 * i tak wylapie synchronizacja. Indeks wyszukiwania Stripe bywa opozniony (~1 min), a dwie
 * sesje otwarte jednoczesnie przejda obie, wiec to zawezenie okna, nie gwarancja.
 */
export async function hasActivePremiumSubscription(serviceId: string): Promise<boolean> {
    // `serviceId` to UUID wpisu z bazy (wejscie akcji przeszlo `z.string().uuid()`),
    // wiec nie zawiera apostrofu, ktory zamknalby wartosc w jezyku zapytan Stripe.
    const query = `metadata['${SUBSCRIPTION_METADATA_KEYS.serviceId}']:'${serviceId}'`;
    try {
        const result = await withTimeout(
            getStripe().subscriptions.search({ query, limit: SEARCH_LIMIT }),
            SUBSCRIPTION_SEARCH_TIMEOUT_MS,
            () => new TimeoutError('Stripe subscription search', SUBSCRIPTION_SEARCH_TIMEOUT_MS),
        );
        return result.data.some(subscription => BLOCKING_STATUSES.has(subscription.status));
    } catch (error) {
        // Sama nazwa bledu: komunikat Stripe potrafi zawierac fragment klucza API.
        console.error('premium-checkout: subscription search failed, continuing', {
            name: error instanceof Error ? error.name : typeof error,
        });
        return false;
    }
}
