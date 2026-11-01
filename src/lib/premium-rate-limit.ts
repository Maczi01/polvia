import 'server-only';

import { headers } from 'next/headers';

import { checkRateLimitWithTimeout, getClientIp, rateLimitSubject } from '@/lib/rate-limit';

/**
 * Limity po IP dla publicznych wejsc premium: dwie Server Actions profilu i strona
 * `dziekujemy`. Wszystkie wolaja API Stripe (limit konta wspolny z webhookiem), a akcja
 * materialow dodatkowo wysyla mail.
 */

export type PremiumLimitedEndpoint = 'checkout' | 'materials' | 'thanks';

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

/** Ile zapytan na godzine wolno z jednego IP (IPv6: z jednej sieci /64). */
export const PREMIUM_LIMIT_PER_IP: Record<PremiumLimitedEndpoint, number> = {
    /** Kilka prob miesci zmiane interwalu i powrot z anulowanego Checkout. */
    checkout: 10,
    /** Formularz wysyla sie raz; zapas na poprawki po bledzie. */
    materials: 5,
    /** Kazde wejscie to `checkout.sessions.retrieve`; miesci odswiezanie, ucina skrypt. */
    thanks: 20,
};

/**
 * Czy zapytanie miesci sie w limicie endpointu. Adres i klucz liczone tutaj, wiec wolajacy,
 * ktory lapie bledy (fail-open na stronie), lapie tez blad programistyczny w ich wyliczeniu.
 * Rzuca przy awarii albo zawieszeniu Redisa (`RateLimitCheckTimeoutError` po 1,5 s) —
 * polityke wybiera wolajacy.
 */
export async function isWithinPremiumLimit(endpoint: PremiumLimitedEndpoint): Promise<boolean> {
    const ip = getClientIp({ headers: await headers() });
    const result = await checkRateLimitWithTimeout({
        key: `premium:${endpoint}:${rateLimitSubject(ip)}`,
        max: PREMIUM_LIMIT_PER_IP[endpoint],
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    return result.allowed;
}
