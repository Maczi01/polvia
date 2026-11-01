import 'server-only';

import Stripe from 'stripe';
import { z } from 'zod';

import type { Locale } from '@/i18n/config';
import type { PremiumInterval } from '@/lib/premium-checkout-fields';
import {
    getPremiumCheckoutTarget,
    type PremiumCheckoutTarget,
} from '@/lib/premium-checkout-queries';
import { hasOnlyPremiumPrices } from '@/lib/premium-prices';
import { buildProfileCanonicalUrl } from '@/lib/service-profile-metadata';
import { stripe } from '@/lib/stripe';
import { SUBSCRIPTION_METADATA_KEYS } from '@/lib/subscription-sync';

import { env } from '../../env';

/**
 * Stripe Checkout dla premium: tworzenie sesji z profilu i weryfikacja sesji po powrocie.
 *
 * Surowy blad Stripe zostaje w logu serwera — wolajacy dostaje tylko wynik bez szczegolow.
 */

/** Strona sukcesu wzgledem profilu; `{CHECKOUT_SESSION_ID}` podstawia Stripe. */
export const CHECKOUT_SUCCESS_SUFFIX = '/premium/dziekujemy?session_id={CHECKOUT_SESSION_ID}';

/** Allowlista cen: klient wybiera tylko interwal, nigdy kwote ani ID ceny. */
function priceIdFor(interval: PremiumInterval): string {
    return interval === 'yearly' ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;
}

/** Jezyk strony Checkout. Stripe nie ma ukrainskiego — `auto` bierze jezyk przegladarki. */
const CHECKOUT_LOCALES: Record<Locale, Stripe.Checkout.SessionCreateParams.Locale> = {
    pl: 'pl',
    en: 'en',
    ru: 'ru',
    uk: 'auto',
};

function describeStripeError(error: unknown): { name: string; code: string | null } {
    if (error instanceof Stripe.errors.StripeError) {
        return { name: error.type, code: error.code ?? null };
    }
    return { name: error instanceof Error ? error.name : typeof error, code: null };
}

export type CreateCheckoutInput = {
    target: PremiumCheckoutTarget;
    interval: PremiumInterval;
    locale: Locale;
};

/**
 * Sesja subskrypcji powiazana z wpisem. `client_reference_id` i metadane subskrypcji niosa
 * `serviceId`, a `serviceSlug` pozwala webhookowi powiazac subskrypcje po `db:reset`
 * (nowe `id`, ten sam slug). Zwraca adres Checkout albo `null`, gdy Stripe zawiodl.
 */
export async function createPremiumCheckoutSession({
    target,
    interval,
    locale,
}: CreateCheckoutInput): Promise<string | null> {
    const profileUrl = buildProfileCanonicalUrl(env.NEXT_PUBLIC_SITE_URL, locale, target.slug);

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: priceIdFor(interval), quantity: 1 }],
            client_reference_id: target.serviceId,
            subscription_data: {
                metadata: {
                    [SUBSCRIPTION_METADATA_KEYS.serviceId]: target.serviceId,
                    [SUBSCRIPTION_METADATA_KEYS.serviceSlug]: target.slug,
                },
            },
            tax_id_collection: { enabled: true },
            billing_address_collection: 'required',
            locale: CHECKOUT_LOCALES[locale],
            success_url: `${profileUrl}${CHECKOUT_SUCCESS_SUFFIX}`,
            cancel_url: profileUrl,
        });
        return session.url;
    } catch (error) {
        console.error('premium-checkout: session create failed', describeStripeError(error));
        return null;
    }
}

export type CheckoutPayer = {
    email: string | null;
    name: string | null;
    /** Numery podatkowe z Checkout (np. `eu_vat PL1234567890`). */
    taxIds: string[];
    address: string | null;
};

export type CheckoutVerification =
    | { status: 'paid'; target: PremiumCheckoutTarget; payer: CheckoutPayer }
    | { status: 'invalid' }
    | { status: 'unavailable' };

const serviceIdSchema = z.string().uuid();

/**
 * Oplacona sesja subskrypcji NASZEJ ceny premium. Bez sprawdzenia ceny dowolny Payment Link
 * subskrypcyjny na koncie (inny/tanszy produkt) z `?client_reference_id=<uuid wpisu>`
 * przeszedlby jako zakup premium (UUID-y wpisow sa publiczne).
 */
function isPaidPremiumSession(session: Stripe.Checkout.Session): boolean {
    const priceIds = (session.line_items?.data ?? []).map(item => item.price?.id ?? '');
    return (
        session.mode === 'subscription' &&
        session.status === 'complete' &&
        session.payment_status === 'paid' &&
        hasOnlyPremiumPrices(priceIds)
    );
}

function formatAddress(address: Stripe.Address | null | undefined): string | null {
    if (!address) return null;
    const parts = [
        address.line1,
        address.line2,
        address.postal_code,
        address.city,
        address.country,
    ];
    const text = parts.filter(Boolean).join(', ');
    return text === '' ? null : text;
}

function toPayer(session: Stripe.Checkout.Session): CheckoutPayer {
    const details = session.customer_details;
    return {
        email: details?.email ?? null,
        name: details?.name ?? null,
        taxIds: (details?.tax_ids ?? []).map(taxId => `${taxId.type} ${taxId.value}`),
        address: formatAddress(details?.address),
    };
}

async function retrieveSession(
    sessionId: string,
): Promise<Stripe.Checkout.Session | 'missing' | 'unavailable'> {
    try {
        // `line_items` nie sa domyslnie w odpowiedzi — potrzebne do sprawdzenia ceny.
        return await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
    } catch (error) {
        if (error instanceof Stripe.errors.StripeInvalidRequestError) return 'missing';
        console.error('premium-checkout: session retrieve failed', describeStripeError(error));
        return 'unavailable';
    }
}

/**
 * Czy sesja Checkout jest oplacona, z cena premium, i dotyczy wpisu spod `slug`. Strona sukcesu i akcja
 * materialow wolaja ja niezaleznie: akcja to publiczny POST, wiec nie ufa stronie.
 * Nie zalezy od webhooka — premium moze sie jeszcze nie wlaczyc.
 */
export async function verifyPaidCheckoutSession(
    sessionId: string,
    slug: string,
): Promise<CheckoutVerification> {
    const session = await retrieveSession(sessionId);
    if (session === 'unavailable') return { status: 'unavailable' };
    if (session === 'missing' || !isPaidPremiumSession(session)) return { status: 'invalid' };

    const serviceId = serviceIdSchema.safeParse(session.client_reference_id);
    if (!serviceId.success) return { status: 'invalid' };

    const target = await getPremiumCheckoutTarget(serviceId.data);
    if (!target || target.slug !== slug) return { status: 'invalid' };

    return { status: 'paid', target, payer: toPayer(session) };
}
