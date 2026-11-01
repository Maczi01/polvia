import 'server-only';

import Stripe from 'stripe';

import { env } from '../../env';

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

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    timeout: STRIPE_TIMEOUT_MS,
    maxNetworkRetries: 1,
    typescript: true,
});
