import { isManualPremiumActive } from './manual-premium';

/**
 * Stan premium wpisu — jedyne miejsce, ktore decyduje, czy premium jest aktywne.
 * Status premium FIRMY (widok profilu, alias, blokada checkoutu): `hasActivePremium`.
 * `isPremiumActive` ocenia sam rekord subskrypcji Stripe (synchronizacja, ranking).
 *
 * Modul czysty (bez `server-only`, `src/db` i Stripe): stan liczymy na odczycie z danych
 * subskrypcji i daty premium recznego, bez crona. Statusy to statusy subskrypcji Stripe; schemat bazy zrobi z
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
    /**
     * Poczatek biezacego okresu. Przy odnowieniu Stripe przesuwa okres PRZED proba platnosci,
     * wiec dla `past_due` to moment nieudanego odnowienia — od niego liczymy karencje.
     */
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
};

/** Karencja po nieudanym odnowieniu (`past_due`) i ponad koniec oplaconego okresu. */
export const PREMIUM_GRACE_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `past_due` zostaje aktywne do konca karencji; reszta statusow to brak platnosci. */
const PREMIUM_ENTITLED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
    'active',
    'trialing',
    'past_due',
]);

/**
 * Koniec uprawnien premium: koniec oplaconego okresu plus karencja. Dla `past_due` okres jest
 * juz przesuniety na nieoplacony, wiec oplacony skonczyl sie na jego poczatku — karencja
 * liczona od `currentPeriodStart`, nie od nowego konca (inaczej premium przez caly cykl
 * Smart Retries, przy planie rocznym nawet rok, bez platnosci).
 */
export function premiumRankingExpiry(sub: PremiumSubscriptionState): Date {
    const paidUntil = sub.status === 'past_due' ? sub.currentPeriodStart : sub.currentPeriodEnd;
    return new Date(paidUntil.getTime() + PREMIUM_GRACE_DAYS * MS_PER_DAY);
}

export function isPremiumActive(sub: PremiumSubscriptionState | null, now: Date): boolean {
    if (!sub) return false;
    if (!PREMIUM_ENTITLED_STATUSES.has(sub.status)) return false;

    return now.getTime() < premiumRankingExpiry(sub).getTime();
}

/** Wszystko, co decyduje o premium wpisu — czytane w jednym zapytaniu z wierszem wpisu. */
export type PremiumState = {
    /** Rekord `service_subscriptions` tego wpisu; `null`: brak subskrypcji. */
    subscription: PremiumSubscriptionState | null;
    /** `service_profiles.manual_premium_until` (premium oplacone przelewem); `null`: brak. */
    manualPremiumUntil: Date | null;
};

/**
 * Jedyne zrodlo prawdy o premium firmy: subskrypcja Stripe ALBO premium reczne
 * (`manual-premium.ts`, aktywne do konca dnia `activeUntil` w strefie Europe/Warsaw).
 */
export function hasActivePremium(
    { subscription, manualPremiumUntil }: PremiumState,
    now: Date,
): boolean {
    return isPremiumActive(subscription, now) || isManualPremiumActive(manualPremiumUntil, now);
}
