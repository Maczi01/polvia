'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import { defaultLocale, type Locale, locales } from '@/i18n/config';
import { getOperatorInbox, sendMail } from '@/lib/mailer';
import {
    type CheckoutPayer,
    createPremiumCheckoutSession,
    verifyPaidCheckoutSession,
} from '@/lib/premium-checkout';
import type {
    CheckoutErrorCode,
    CheckoutState,
    MaterialsErrorCode,
    MaterialsFieldErrors,
    MaterialsState,
} from '@/lib/premium-checkout-fields';
import {
    getPremiumCheckoutTarget,
    type PremiumCheckoutTarget,
} from '@/lib/premium-checkout-queries';
import { checkRateLimit, getClientIp, rateLimitSubject } from '@/lib/rate-limit';
import { buildServiceProfilePath } from '@/lib/service-profile-path';
import { STRIPE_LIVE_MODE } from '@/lib/stripe';

import {
    invalidMaterialsFields,
    type MaterialsInput,
    PREMIUM_MATERIALS_MAX_LENGTH,
    parseCheckoutForm,
    parseMaterialsForm,
} from './_checkout-schema';

/**
 * Akcje premium z profilu firmy. Kazda to publiczny endpoint POST: nie ufaja formularzowi
 * (cena z allowlisty env, wpis i sesja sprawdzane na serwerze) i maja limit po IP.
 * Bez `revalidatePath`: checkout niczego nie zapisuje (stan premium ustawia webhook),
 * a materialy ida mailem.
 */

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
/** Kilka prob na godzine miesci zmiane interwalu i powrot z anulowanego Checkout. */
const CHECKOUT_PER_IP = 10;
/** Formularz wysyla sie raz; zapas na poprawki po bledzie. */
const MATERIALS_PER_IP = 5;

/** Platnosc testowa (klucz `sk_test_`) — founder nie moze wziac maila za prawdziwy zakup. */
function materialsMailSubject(serviceName: string): string {
    const subject = `Premium: materialy od ${serviceName}`;
    return STRIPE_LIVE_MODE ? subject : `[TEST] ${subject}`;
}

async function requestLocale(): Promise<Locale> {
    const locale = await getLocale();
    return hasLocale(locales, locale) ? locale : defaultLocale;
}

async function isWithinLimit(endpoint: string, max: number): Promise<boolean> {
    const ip = getClientIp({ headers: await headers() });
    const result = await checkRateLimit({
        key: `premium:${endpoint}:${rateLimitSubject(ip)}`,
        max,
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    return result.allowed;
}

export async function startPremiumCheckout(
    _previous: CheckoutState,
    formData: FormData,
): Promise<CheckoutState> {
    const locale = await requestLocale();
    const t = await getTranslations({ locale, namespace: 'ServiceProfile.checkout.errors' });
    const fail = (code: CheckoutErrorCode): CheckoutState => ({
        error: { code, message: t(code) },
    });

    const input = parseCheckoutForm(formData);
    if (!input.success) return fail('BAD_INPUT');
    if (!(await isWithinLimit('checkout', CHECKOUT_PER_IP))) return fail('RATE_LIMITED');

    const target = await getPremiumCheckoutTarget(input.data.serviceId);
    if (!target) return fail('NOT_FOUND');
    if (target.hasActivePremium) return fail('ALREADY_PREMIUM');

    const checkoutUrl = await createPremiumCheckoutSession({
        target,
        interval: input.data.interval,
        locale,
    });
    if (!checkoutUrl) return fail('CHECKOUT_FAILED');

    // Poza `try`: `redirect` rzuca wyjatek sterujacy, ktory musi dojsc do Next.
    redirect(checkoutUrl);
}

function orDash(value: string | null): string {
    return value && value.trim() !== '' ? value : '—';
}

function buildMaterialsMailText(
    input: MaterialsInput,
    target: PremiumCheckoutTarget,
    payer: CheckoutPayer,
): string {
    return [
        `Firma: ${target.name}`,
        `Profil: ${buildServiceProfilePath('pl', target.slug)}`,
        `ID wpisu: ${target.serviceId}`,
        `Sesja Checkout: ${input.sessionId}`,
        '',
        `Placacy: ${orDash(payer.name)}`,
        `E-mail: ${orDash(payer.email)}`,
        `NIP: ${orDash(payer.taxIds.join(', '))}`,
        `Adres: ${orDash(payer.address)}`,
        '',
        `Szablon: ${input.template}`,
        '',
        'Cennik:',
        orDash(input.priceList),
        '',
        'FAQ:',
        orDash(input.faq),
        '',
        'Uwagi:',
        orDash(input.notes),
    ].join('\n');
}

type MaterialsTranslator = Awaited<ReturnType<typeof getTranslations>>;

function toFieldErrors(
    fields: ReturnType<typeof invalidMaterialsFields>,
    t: MaterialsTranslator,
): MaterialsFieldErrors {
    const errors: MaterialsFieldErrors = {};
    for (const field of fields) {
        errors[field] =
            field === 'template'
                ? t('templateRequired')
                : t('tooLong', { max: PREMIUM_MATERIALS_MAX_LENGTH[field] });
    }
    return errors;
}

export async function submitPremiumMaterials(
    _previous: MaterialsState,
    formData: FormData,
): Promise<MaterialsState> {
    const locale = await requestLocale();
    const t = await getTranslations({ locale, namespace: 'ServiceProfile.materials.errors' });
    const fail = (code: MaterialsErrorCode, fields?: MaterialsFieldErrors): MaterialsState => ({
        error: { code, message: t(code), fields },
    });

    const input = parseMaterialsForm(formData);
    if (!input.success) {
        return fail('BAD_INPUT', toFieldErrors(invalidMaterialsFields(input.error), t));
    }
    if (!(await isWithinLimit('materials', MATERIALS_PER_IP))) return fail('RATE_LIMITED');

    const checkout = await verifyPaidCheckoutSession(input.data.sessionId, input.data.slug);
    if (checkout.status === 'unavailable') return fail('VERIFY_FAILED');
    if (checkout.status === 'invalid') return fail('FORBIDDEN');

    const sent = await sendMail({
        to: getOperatorInbox(),
        replyTo: checkout.payer.email ?? undefined,
        subject: materialsMailSubject(checkout.target.name),
        text: buildMaterialsMailText(input.data, checkout.target, checkout.payer),
    });
    if (!sent.ok) return fail('SEND_FAILED');

    return { data: { sent: true } };
}
