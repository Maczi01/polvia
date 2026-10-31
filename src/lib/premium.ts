/**
 * Stan premium wpisu — jedyne miejsce, ktore decyduje, czy premium jest aktywne.
 *
 * Modul czysty (bez `server-only`, `src/db` i Stripe): stan liczymy na odczycie z danych
 * subskrypcji, bez crona. Statusy to statusy subskrypcji Stripe; schemat bazy zrobi z
 * `SUBSCRIPTION_STATUSES` enum, wiec ta stala jest zrodlem prawdy.
 */
export const SUBSCRIPTION_STATUSES = [
    'active',
    'trialing',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type PremiumSubscriptionState = {
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
};

/** Karencja ponad koniec okresu — czas na Smart Retries Stripe przy `past_due`. */
export const PREMIUM_GRACE_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `past_due` zostaje aktywne do konca karencji; reszta statusow to brak platnosci. */
const PREMIUM_ENTITLED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
    'active',
    'trialing',
    'past_due',
]);

/** Koniec uprawnien premium: koniec oplaconego okresu plus karencja. */
export function premiumRankingExpiry(sub: PremiumSubscriptionState): Date {
    return new Date(sub.currentPeriodEnd.getTime() + PREMIUM_GRACE_DAYS * MS_PER_DAY);
}

export function isPremiumActive(sub: PremiumSubscriptionState | null, now: Date): boolean {
    if (!sub) return false;
    if (!PREMIUM_ENTITLED_STATUSES.has(sub.status)) return false;

    return now.getTime() < premiumRankingExpiry(sub).getTime();
}
