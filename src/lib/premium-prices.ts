import 'server-only';

import { stripeConfig } from '@/lib/stripe';

/**
 * Allowlista cen premium. Konto Stripe moze miec inne produkty i Payment Linki, a UUID-y
 * wpisow sa publiczne — premium daje wylacznie subskrypcja/sesja z jedna z tych cen.
 * Bez konfiguracji Stripe zadna cena nie jest cena premium.
 */
export function isPremiumPriceId(priceId: string): boolean {
    if (stripeConfig === null) return false;
    return priceId === stripeConfig.priceMonthly || priceId === stripeConfig.priceYearly;
}

/** Wszystkie pozycje (co najmniej jedna) maja cene premium. */
export function hasOnlyPremiumPrices(priceIds: readonly string[]): boolean {
    return priceIds.length > 0 && priceIds.every(priceId => isPremiumPriceId(priceId));
}
