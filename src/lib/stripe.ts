import 'server-only';

import Stripe from 'stripe';

import { env } from '../../env';
import { resolveStripeConfig, type StripeConfig } from './stripe-config';

/**
 * Wersja API przypieta do paczki `stripe@23.0.1` (typy paczki opisuja tylko te wersje).
 * Podbicie paczki = podbicie wersji tutaj i przeglad zmian w ksztalcie obiektow
 * (np. `current_period_end` lezy od 2025 na pozycjach subskrypcji, nie na subskrypcji).
 */
export const STRIPE_API_VERSION = '2026-09-30.endive' satisfies Stripe.LatestApiVersion;

/**
 * Limit jednego zapytania do Stripe. Domyslne 80 s przezyloby `maxDuration` funkcji
 * webhooka — Vercel ubilby ja bez logu. Z jednym ponowieniem najgorszy przypadek to ~2×.
 */
export const STRIPE_TIMEOUT_MS = 8000;

/**
 * Konfiguracja Stripe albo `null`, gdy platnosci online sa wylaczone (brak wszystkich
 * zmiennych `STRIPE_*`). Czesciowa konfiguracja rzuca juz w `env.ts`.
 */
export const stripeConfig: StripeConfig | null = resolveStripeConfig(env);

/** Platnosci online wlaczone. Wylaczone: premium sprzedawane recznie przez kontakt. */
export const isStripeConfigured = stripeConfig !== null;

/** Klucz produkcyjny: sekretny (`sk_live_`) albo ograniczony (`rk_live_`); reszta to test. */
export function isLiveStripeKey(secretKey: string): boolean {
    return secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_');
}

export type StripeKeyMode = 'live' | 'test';

function keyModeOf(config: StripeConfig | null): StripeKeyMode | null {
    if (config === null) return null;
    return isLiveStripeKey(config.secretKey) ? 'live' : 'test';
}

/** Tryb klucza albo `null`, gdy Stripe nie jest skonfigurowany. */
export const STRIPE_KEY_MODE = keyModeOf(stripeConfig);

/**
 * Tryb konta, w ktorym dziala ta instancja. Zdarzenie albo subskrypcja z innym `livemode`
 * nie moze zmienic stanu premium — inaczej testowa subskrypcja (karta 4242) zapisana do
 * produkcyjnej bazy dalaby prawdziwemu wpisowi darmowe premium. Bez konfiguracji `false`.
 */
export const STRIPE_LIVE_MODE = STRIPE_KEY_MODE === 'live';

/** Wolanie Stripe przy wylaczonych platnosciach online — blad programistyczny wolajacego. */
export class StripeNotConfiguredError extends Error {
    readonly code = 'STRIPE_NOT_CONFIGURED';

    constructor() {
        super('Stripe is not configured (STRIPE_* env vars are missing)');
        this.name = 'StripeNotConfiguredError';
    }
}

/** Konfiguracja albo `StripeNotConfiguredError`. */
export function requireStripeConfig(): StripeConfig {
    if (stripeConfig === null) throw new StripeNotConfiguredError();
    return stripeConfig;
}

let client: Stripe | null = null;

/**
 * Klient Stripe tworzony leniwie przy pierwszym uzyciu — import modulu bez zmiennych
 * `STRIPE_*` nie rzuca. Bez konfiguracji: `StripeNotConfiguredError`.
 */
export function getStripe(): Stripe {
    const config = requireStripeConfig();
    client ??= new Stripe(config.secretKey, {
        apiVersion: STRIPE_API_VERSION,
        timeout: STRIPE_TIMEOUT_MS,
        maxNetworkRetries: 1,
        typescript: true,
    });
    return client;
}
