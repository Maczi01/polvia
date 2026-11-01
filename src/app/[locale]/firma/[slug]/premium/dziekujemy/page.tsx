import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactElement, ReactNode } from 'react';

import { defaultLocale, type Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getOperatorInbox } from '@/lib/mailer';
import { verifyPaidCheckoutSession } from '@/lib/premium-checkout';
import { PREMIUM_GALLERY_MAX } from '@/lib/premium-templates';
import { isValidServiceSlug } from '@/lib/service-slug-format';

import { env } from '../../../../../../../env';
import { submitPremiumMaterials } from '../../_actions';
import { checkoutSessionIdSchema } from '../../_checkout-schema';
import { PremiumMaterialsForm } from '../../_components/premium-materials-form/premium-materials-form';

type PageProps = {
    params: Promise<{ locale: string; slug: string }>;
    searchParams: Promise<{ session_id?: string | string[] }>;
};

function toLocale(value: string): Locale {
    return hasLocale(routing.locales, value) ? value : defaultLocale;
}

/** Strona po platnosci: tylko dla platnika z linku Stripe, nigdy w indeksie. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale: toLocale(locale), namespace: 'ServiceProfile' });
    return { title: t('premiumThanks.metaTitle'), robots: { index: false, follow: false } };
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

async function PaymentConfirmedCard(): Promise<ReactElement> {
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
                    href={env.STRIPE_PORTAL_LOGIN_URL}
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
            />
        </section>
    );
}

/**
 * Powrot ze Stripe Checkout (`success_url`). Sesja jest sprawdzana w Stripe przed renderem:
 * formularz materialow dostaje tylko oplacona sesja tego wpisu. Strona nie czeka na webhook —
 * premium wlacza sie osobno, „w ciagu kilku minut”.
 */
export default async function PremiumThanksPage({
    params,
    searchParams,
}: PageProps): Promise<ReactElement> {
    const { locale, slug } = await params;
    setRequestLocale(toLocale(locale));
    const { session_id: rawSessionId } = await searchParams;

    // Zly format id albo slugu nie dochodzi do Stripe — od razu „nie potwierdzono”, nie 500.
    const sessionId = checkoutSessionIdSchema.safeParse(rawSessionId);
    if (!sessionId.success || !isValidServiceSlug(slug)) {
        return <CheckoutNotConfirmed slug={slug} />;
    }

    const verification = await verifyPaidCheckoutSession(sessionId.data, slug);
    if (verification.status !== 'paid') return <CheckoutNotConfirmed slug={slug} />;

    return (
        <PageShell>
            <PaymentConfirmedCard />
            <MaterialsCard sessionId={sessionId.data} slug={slug} />
        </PageShell>
    );
}
