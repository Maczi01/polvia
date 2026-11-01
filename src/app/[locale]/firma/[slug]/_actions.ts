'use server';

import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';

import { type Locale, toLocale } from '@/i18n/config';
import { getOperatorInbox, type MailMessage, sendMail, type SendMailResult } from '@/lib/mailer';
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
    PremiumMaterialsField,
} from '@/lib/premium-checkout-fields';
import {
    getPremiumCheckoutTarget,
    type PremiumCheckoutTarget,
} from '@/lib/premium-checkout-queries';
import { claimMaterialsSend, releaseMaterialsSend } from '@/lib/premium-materials-sent';
import { isWithinPremiumLimit } from '@/lib/premium-rate-limit';
import { hasActivePremiumSubscription } from '@/lib/premium-subscription-search';
import { buildProfileCanonicalUrl } from '@/lib/service-profile-metadata';
import { STRIPE_LIVE_MODE } from '@/lib/stripe';
import { TimeoutError, withTimeout } from '@/lib/with-timeout';

import { env } from '../../../../../env';

import {
    invalidMaterialsFields,
    type MaterialsInput,
    PREMIUM_MATERIALS_MAX_LENGTH,
    parseCheckoutForm,
    parseMaterialsForm,
} from './_checkout-schema';

/**
 * Akcje premium z profilu firmy. Kazda to publiczny endpoint POST: nie ufaja formularzowi
 * (cena z allowlisty env, wpis i sesja sprawdzane na serwerze) i maja limit po IP
 * (`premium-rate-limit`; awaria Redisa konczy akcje bledem — fail-open ma tylko strona
 * `dziekujemy`). Bez `revalidatePath`: checkout niczego nie zapisuje (stan premium ustawia
 * webhook), a materialy ida mailem.
 */

/**
 * Calkowity limit wysylki materialow. Nodemailer ma limit per faza SMTP (10 s), wiec
 * polaczenie + powitanie + wysylka to do ~30 s. Budzet akcji opisuje `maxDuration` strony
 * `dziekujemy`, z ktorej akcja jest wolana.
 */
const MATERIALS_MAIL_TIMEOUT_MS = 20_000;

const MATERIALS_SENT: MaterialsState = { data: { sent: true } };

/** Platnosc testowa (klucz `sk_test_`) — founder nie moze wziac maila za prawdziwy zakup. */
function materialsMailSubject(serviceName: string): string {
    const subject = `Premium: materialy od ${serviceName}`;
    return STRIPE_LIVE_MODE ? subject : `[TEST] ${subject}`;
}

async function requestLocale(): Promise<Locale> {
    return toLocale(await getLocale());
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
    if (!(await isWithinPremiumLimit('checkout'))) return fail('RATE_LIMITED');

    const target = await getPremiumCheckoutTarget(input.data.serviceId);
    if (!target) return fail('NOT_FOUND');
    if (target.hasActivePremium) return fail('ALREADY_PREMIUM');
    // Oplacona subskrypcja, ktorej webhook jeszcze nie zapisal — druga karta = druga platnosc.
    if (await hasActivePremiumSubscription(target.serviceId)) return fail('ALREADY_PREMIUM');

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
        `Profil: ${buildProfileCanonicalUrl(env.NEXT_PUBLIC_SITE_URL, 'pl', target.slug)}`,
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
    fields: PremiumMaterialsField[],
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

function errorName(error: unknown): string {
    return error instanceof Error ? error.name : typeof error;
}

/**
 * `claimed` — ta proba wysyla; `already_sent` — sesja ma juz znacznik; `unmarked` — Redis
 * niedostepny: wysylamy bez znacznika, bo duplikat maila jest mniejszym zlem niz platnik,
 * ktory nie moze oddac materialow. Bledy Redisa nie maja wspolnej klasy, stad szeroki `catch`.
 */
async function claimSend(sessionId: string): Promise<'claimed' | 'already_sent' | 'unmarked'> {
    try {
        return (await claimMaterialsSend(sessionId)) ? 'claimed' : 'already_sent';
    } catch (error) {
        console.error('premium-materials: sent marker unavailable, sending without it', {
            error: errorName(error),
        });
        return 'unmarked';
    }
}

/** Po nieudanej wysylce platnik ma moc sprobowac ponownie, wiec znacznik znika. */
async function releaseSend(sessionId: string): Promise<void> {
    try {
        await releaseMaterialsSend(sessionId);
    } catch (error) {
        console.error('premium-materials: could not release sent marker', {
            error: errorName(error),
        });
    }
}

/**
 * `sendMail` z calkowitym limitem czasu. Po przekroczeniu mail moze jeszcze dojsc —
 * znacznik i tak jest zwalniany, bo zgubione materialy sa gorsze niz duplikat.
 */
async function sendMaterialsMail(message: MailMessage): Promise<SendMailResult> {
    try {
        return await withTimeout(
            sendMail(message),
            MATERIALS_MAIL_TIMEOUT_MS,
            () => new TimeoutError('Materials mail', MATERIALS_MAIL_TIMEOUT_MS),
        );
    } catch (error) {
        // `sendMail` nie rzuca — inny blad niz timeout to blad programistyczny.
        if (!(error instanceof TimeoutError)) throw error;
        console.error('premium-materials: mail timed out', { timeoutMs: error.timeoutMs });
        return { ok: false, code: 'SEND_FAILED' };
    }
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
    if (!(await isWithinPremiumLimit('materials'))) return fail('RATE_LIMITED');

    const { sessionId, slug } = input.data;
    const checkout = await verifyPaidCheckoutSession(sessionId, slug);
    if (checkout.status === 'unavailable') return fail('VERIFY_FAILED');
    if (checkout.status === 'invalid') return fail('FORBIDDEN');

    // Znacznik dopiero po weryfikacji: obcy nie zajmie wysylki cudzej sesji.
    const claim = await claimSend(sessionId);
    // Duplikat (odswiezenie, drugie klikniecie, ponowiony POST): wynik jak po pierwszej
    // wysylce, bez drugiego maila.
    if (claim === 'already_sent') return MATERIALS_SENT;

    const sent = await sendMaterialsMail({
        to: getOperatorInbox(),
        replyTo: checkout.payer.email ?? undefined,
        subject: materialsMailSubject(checkout.target.name),
        text: buildMaterialsMailText(input.data, checkout.target, checkout.payer),
    });
    if (!sent.ok) {
        if (claim === 'claimed') await releaseSend(sessionId);
        return fail('SEND_FAILED');
    }

    return MATERIALS_SENT;
}
