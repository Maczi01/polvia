import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactElement, ReactNode } from 'react';

import { toLocale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { getOperatorInbox } from '@/lib/mailer';
import { verifyPaidCheckoutSession } from '@/lib/premium-checkout';
import { isMaterialsSent } from '@/lib/premium-materials-sent';
import { isWithinPremiumLimit } from '@/lib/premium-rate-limit';
import { PREMIUM_GALLERY_MAX } from '@/lib/premium-templates';
import { isValidServiceSlug } from '@/lib/service-slug-format';
import { stripeConfig } from '@/lib/stripe';

import { submitPremiumMaterials } from '../../_actions';
import { checkoutSessionIdSchema } from '../../_checkout-schema';
import { PremiumMaterialsForm } from '../../_components/premium-materials-form/premium-materials-form';

/**
 * Limit funkcji obejmuje tez `submitPremiumMaterials` — akcja wolana z tej strony wykonuje sie
 * w tej samej funkcji. Najgorszy przypadek akcji: limit 1,5 s + `retrieve` 8 s × 2 (ponowienie)
 * + znacznik 1,5 s + SMTP 20 s (`MATERIALS_MAIL_TIMEOUT_MS`) + zwolnienie znacznika 1,5 s
 * ≈ 41 s. Render: limit 1,5 s + Stripe 16 s + znacznik 1,5 s ≈ 19 s.
 */
export const maxDuration = 60;

type PageProps = {
    params: Promise<{ locale: string; slug: string }>;
    searchParams: Promise<{ session_id?: string | string[] }>;
};

/**
 * Awaria Redisa (`RateLimitStoreError`, przekroczony czas, zerwane polaczenie ioredis — bez
 * wspolnej klasy bledu) przepuszcza do Stripe: platnik tuz po zaplacie ma zobaczyc
 * potwierdzenie, a Stripe ma wlasny limit API. Fail-closed dawaloby „odswiez” na caly
 * czas awarii, a strona nie ma tu nic do ochrony poza kwota zapytan do Stripe.
 */
async function isWithinVerifyLimit(): Promise<boolean> {
    try {
        // Adres i klucz liczone w `try`: blad programistyczny tez konczy sie logiem.
        return await isWithinPremiumLimit('thanks');
    } catch (error) {
        // Bez IP w logu — to dane osobowe, a do diagnozy awarii Redisa niepotrzebne.
        console.error('premium-thanks: rate limit store unavailable, failing open', {
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
        return true;
    }
}

/** Awaria Redisa: formularz zamiast potwierdzenia — duplikat i tak odrzuci akcja. */
async function wasMaterialsSent(sessionId: string): Promise<boolean> {
    try {
        return await isMaterialsSent(sessionId);
    } catch (error) {
        console.error('premium-thanks: materials marker unavailable, showing form', {
            error: error instanceof Error ? error.name : String(error),
        });
        return false;
    }
}

/** Strona po platnosci: tylko dla platnika z linku Stripe, nigdy w indeksie. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale: toLocale(locale), namespace: 'ServiceProfile' });
    return {
        title: t('premiumThanks.metaTitle'),
        robots: { index: false, follow: false },
        // `session_id` w adresie nie moze wyjsc w `Referer` do portalu Stripe ani innych linkow.
        referrer: 'no-referrer',
    };
}

const CARD_CLASSES =
    'rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:p-8';

const LINK_CLASSES =
    'font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:text-pink-300';

function PageShell({ children }: { children: ReactNode }): ReactElement {
    return (
        <div className="bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 md:py-12">
                {children}
            </div>
        </div>
    );
}

async function CheckoutNotConfirmed({ slug }: { slug: string }): Promise<ReactElement> {
    const t = await getTranslations('ServiceProfile.premiumThanks');
    return (
        <PageShell>
            <section aria-labelledby="premium-thanks-heading" className={CARD_CLASSES}>
                <h1
                    id="premium-thanks-heading"
                    className="text-2xl font-bold text-gray-900 dark:text-gray-50"
                >
                    {t('invalidTitle')}
                </h1>
                <p className="mt-3 text-gray-600 dark:text-gray-300">{t('invalidDescription')}</p>
                <Link
                    href={{ pathname: '/firma/[slug]', params: { slug } }}
                    className={`mt-6 inline-block ${LINK_CLASSES}`}
                >
                    {t('backToProfile')}
                </Link>
            </section>
        </PageShell>
    );
}

/**
 * Chwilowy brak potwierdzenia (awaria Stripe albo limit zapytan): platnik nie moze
 * zobaczyc „nie potwierdzono”. Odswiezenie to ten sam adres z tym samym `session_id`.
 */
async function CheckoutUnavailable({
    sessionId,
    slug,
}: {
    sessionId: string;
    slug: string;
}): Promise<ReactElement> {
    const t = await getTranslations('ServiceProfile.premiumThanks');
    return (
        <PageShell>
            <section aria-labelledby="premium-thanks-heading" className={CARD_CLASSES}>
                <h1
                    id="premium-thanks-heading"
                    className="text-2xl font-bold text-gray-900 dark:text-gray-50"
                >
                    {t('unavailableTitle')}
                </h1>
                <p className="mt-3 text-gray-600 dark:text-gray-300">
                    {t('unavailableDescription')}
                </p>
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                    {/* Trasy `dziekujemy` nie ma w `pathnames`, a wzgledny adres z samym
                        query zostaje na biezacej sciezce razem z prefiksem locale. */}
                    <a
                        href={`?${new URLSearchParams({ session_id: sessionId }).toString()}`}
                        className={LINK_CLASSES}
                    >
                        {t('refresh')}
                    </a>
                    <Link
                        href={{ pathname: '/firma/[slug]', params: { slug } }}
                        className={LINK_CLASSES}
                    >
                        {t('backToProfile')}
                    </Link>
                </div>
            </section>
        </PageShell>
    );
}

async function PaymentConfirmedCard({ portalUrl }: { portalUrl: string }): Promise<ReactElement> {
    const t = await getTranslations('ServiceProfile.premiumThanks');
    const inbox = getOperatorInbox();

    return (
        <section aria-labelledby="premium-thanks-heading" className={CARD_CLASSES}>
            <CheckCircle2 size={32} aria-hidden="true" className="text-green-600" />
            <h1
                id="premium-thanks-heading"
                className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-50 md:text-3xl"
            >
                {t('title')}
            </h1>
            <p className="mt-3 text-gray-700 dark:text-gray-300">{t('activation')}</p>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
                {t.rich('photos', {
                    max: PREMIUM_GALLERY_MAX,
                    email: inbox,
                    mail: chunks => (
                        <a href={`mailto:${inbox}`} className={LINK_CLASSES}>
                            {chunks}
                        </a>
                    ),
                })}
            </p>
            <p className="mt-3 text-gray-700 dark:text-gray-300">
                {t('portal')}{' '}
                <a
                    href={portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 ${LINK_CLASSES}`}
                >
                    {t('portalLink')}
                    <ExternalLink size={14} aria-hidden="true" />
                </a>
            </p>
        </section>
    );
}

async function MaterialsCard({
    sessionId,
    slug,
}: {
    sessionId: string;
    slug: string;
}): Promise<ReactElement> {
    const t = await getTranslations('ServiceProfile.materials');
    const isAlreadySent = await wasMaterialsSent(sessionId);

    return (
        <section aria-labelledby="premium-materials-heading" className={CARD_CLASSES}>
            <h2
                id="premium-materials-heading"
                className="text-xl font-bold text-gray-900 dark:text-gray-100"
            >
                {t('title')}
            </h2>
            <p className="mb-6 mt-2 text-sm text-gray-600 dark:text-gray-300">{t('description')}</p>
            <PremiumMaterialsForm
                sessionId={sessionId}
                slug={slug}
                action={submitPremiumMaterials}
                isAlreadySent={isAlreadySent}
            />
        </section>
    );
}

/**
 * Powrot ze Stripe Checkout (`success_url`). Sesja jest sprawdzana w Stripe przed renderem:
 * formularz materialow dostaje tylko oplacona sesja tego wpisu. Strona nie czeka na webhook —
 * premium wlacza sie osobno, „w ciagu kilku minut”. Bez konfiguracji Stripe strony nie ma (404):
 * nie ma platnosci, ktora moglaby tu wrocic.
 */
export default async function PremiumThanksPage({
    params,
    searchParams,
}: PageProps): Promise<ReactElement> {
    const config = stripeConfig;
    if (!config) notFound();

    const { locale, slug } = await params;
    setRequestLocale(toLocale(locale));
    const { session_id: rawSessionId } = await searchParams;

    // Zly format id albo slugu nie dochodzi do Stripe — od razu „nie potwierdzono”, nie 500.
    const sessionId = checkoutSessionIdSchema.safeParse(rawSessionId);
    if (!sessionId.success || !isValidServiceSlug(slug)) {
        return <CheckoutNotConfirmed slug={slug} />;
    }

    // Limit przed Stripe: po przekroczeniu nie wolamy API, platnik widzi „odswiez za chwile”.
    if (!(await isWithinVerifyLimit())) {
        return <CheckoutUnavailable sessionId={sessionId.data} slug={slug} />;
    }

    const verification = await verifyPaidCheckoutSession(sessionId.data, slug);
    // Bez `default`: nowy wariant wyniku to blad kompilacji (brak `return`), nie cichy „paid”.
    switch (verification.status) {
        case 'unavailable': {
            return <CheckoutUnavailable sessionId={sessionId.data} slug={slug} />;
        }
        case 'invalid': {
            return <CheckoutNotConfirmed slug={slug} />;
        }
        case 'paid': {
            return (
                <PageShell>
                    <PaymentConfirmedCard portalUrl={config.portalLoginUrl} />
                    <MaterialsCard sessionId={sessionId.data} slug={slug} />
                </PageShell>
            );
        }
    }
}
