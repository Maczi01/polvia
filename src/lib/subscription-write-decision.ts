import { isPremiumActive, type SubscriptionStatus } from '@/lib/premium';
import type { StoredSubscription } from '@/lib/subscription-store';

/**
 * Decyzja synchronizacji subskrypcji: co zrobic z przychodzacym stanem wobec stanu zapisanego
 * dla tego samego wpisu. Czysta funkcja (bez bazy, Stripe i logow) — wykonanie i logi sa
 * w `subscription-sync.ts`.
 *
 * Regula dla dwoch subskrypcji jednego wpisu: wygrywa ZAPISANA (pierwsza powiazana), dopoki
 * daje premium. Jedyny wyjatek to oplacona nowa wobec zapisanej `past_due` (patrz nizej).
 * Webhook wiaze subskrypcje w kolejnosci nadejscia zdarzen, `db:sync-subscriptions` —
 * od najstarszej (`created`). Zwykle to ta sama kolejnosc; roznia sie tylko, gdy zdarzenia
 * nowszej przyszly pierwsze (np. sesja starszej domknieta pozniej). Wtedy po `db:reset`
 * resync wiaze starsza, a mail o konflikcie wskazal do zwrotu nowsza — rozjazd znika, gdy
 * operator anuluje subskrypcje do zwrotu (anulowana nie daje premium, wiec nie wygrywa).
 */
export type SubscriptionDecision =
    | { kind: 'conflict'; activeSubscriptionId: string; isIncomingPaid: boolean }
    | { kind: 'stale' }
    /** `replacedSubscriptionId`: wypierana `past_due` innej subskrypcji (do logu). */
    | { kind: 'write'; replacedSubscriptionId: string | null };

/** Przychodzi z nich zaplata za okres — w odroznieniu od `past_due`, ktora ma tylko karencje. */
const PAID_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(['active', 'trialing']);

/**
 * Statusy, z ktorych subskrypcja Stripe nigdy nie wraca. Odczyt ze Stripe jest przed blokada
 * wiersza, wiec rownolegle zdarzenie moze przyniesc starszy stan — po stanie koncowym kazdy
 * inny stan TEJ SAMEJ subskrypcji jest z definicji nieswiezy.
 *
 * Wyscigi miedzy stanami niekoncowymi (np. nieswiezy `active` zapisany po `past_due`) NIE sa
 * blokowane: okno to czas jednego `retrieve` (sekundy), a kazde kolejne zdarzenie tej
 * subskrypcji (Smart Retries wysylaja `invoice.payment_failed` przy kazdej probie, zmiana
 * statusu — `customer.subscription.updated`) pobiera stan na nowo i go poprawia. Ostatnie
 * zdarzenie cyklu konczy sie stanem koncowym albo `active`, ktorych nieswiezy odczyt nie
 * nadpisze trwale. Recznie: `db:sync-subscriptions`.
 */
const TERMINAL_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
    'canceled',
    'incomplete_expired',
]);

function isPaid(record: StoredSubscription, now: Date): boolean {
    return PAID_STATUSES.has(record.status) && isPremiumActive(record, now);
}

function decideSameSubscription(
    stored: StoredSubscription,
    record: StoredSubscription,
): SubscriptionDecision {
    const isStale = TERMINAL_STATUSES.has(stored.status) && !TERMINAL_STATUSES.has(record.status);
    return isStale ? { kind: 'stale' } : { kind: 'write', replacedSubscriptionId: null };
}

/**
 * - brak zapisu → zapis,
 * - ta sama subskrypcja → zapis, chyba ze to nieswiezy odczyt po stanie koncowym (`stale`),
 * - inna subskrypcja:
 *   - zapisana `past_due` + przychodzaca oplacona → zapis z wyparciem starej. To obrona na
 *     wyscig, nie zwykla sciezka: w karencji `past_due` checkout odmawia (`ALREADY_PREMIUM`,
 *     bo `isPremiumActive` obejmuje karencje), wiec druga subskrypcja powstaje tylko z sesji
 *     otwartej PRZED przejsciem starej w `past_due` (sesja Checkout zyje do 24 h). Bez
 *     wyjatku zaplacona nowa konczylaby sie konfliktem az do jej odnowienia,
 *   - zapisana wciaz daje premium → konflikt bez zapisu (`isIncomingPaid` steruje logiem
 *     i mailem o zwrocie),
 *   - zapisana nie daje premium → zapis (nowa zastepuje wygasla).
 */
export function decideSubscriptionWrite(
    stored: StoredSubscription | null,
    record: StoredSubscription,
    now: Date,
): SubscriptionDecision {
    if (!stored) return { kind: 'write', replacedSubscriptionId: null };
    if (stored.stripeSubscriptionId === record.stripeSubscriptionId) {
        return decideSameSubscription(stored, record);
    }

    const isIncomingPaid = isPaid(record, now);
    if (stored.status === 'past_due' && isIncomingPaid) {
        return { kind: 'write', replacedSubscriptionId: stored.stripeSubscriptionId };
    }
    if (isPremiumActive(stored, now)) {
        return {
            kind: 'conflict',
            activeSubscriptionId: stored.stripeSubscriptionId,
            isIncomingPaid,
        };
    }
    return { kind: 'write', replacedSubscriptionId: null };
}
