import 'server-only';

import { env } from '../../env';

/**
 * Allowlista cen premium. Konto Stripe moze miec inne produkty i Payment Linki, a UUID-y
 * wpisow sa publiczne — premium daje wylacznie subskrypcja/sesja z jedna z tych cen.
 */
export function isPremiumPriceId(priceId: string): boolean {
    return priceId === env.STRIPE_PRICE_MONTHLY || priceId === env.STRIPE_PRICE_YEARLY;
}

/** Wszystkie pozycje (co najmniej jedna) maja cene premium. */
export function hasOnlyPremiumPrices(priceIds: readonly string[]): boolean {
    return priceIds.length > 0 && priceIds.every(priceId => isPremiumPriceId(priceId));
}
