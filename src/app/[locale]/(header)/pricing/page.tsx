import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { JSX } from 'react';

import { defaultLocale, type Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

import { env } from '../../../../../env';
import { PricingPlans } from './_components/pricing-plans/pricing-plans';

interface PageProps {
    params: Promise<{ locale: string }>;
}

function toLocale(value: string): Locale {
    return hasLocale(routing.locales, value) ? value : defaultLocale;
}

export default async function PricingPage({ params }: PageProps): Promise<JSX.Element> {
    const locale = toLocale((await params).locale);
    setRequestLocale(locale);
    const t = await getTranslations('Pricing');

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-16 dark:bg-gray-900">
            <div className="mx-auto max-w-6xl">
                {/* `<main>` daje layout grupy (header) — drugi landmark main bylby zdublowany. */}
                <PricingPlans
                    portalUrl={env.STRIPE_PORTAL_LOGIN_URL}
                    heading={
                        <div>
                            <h1 className="font-sans text-4xl font-extrabold leading-tight text-[#26364d] dark:text-white md:text-5xl">
                                {t('choosePlan')}
                            </h1>
                            <p className="mt-4 max-w-2xl font-sans text-gray-600 dark:text-gray-400">
                                {t('simple')}
                            </p>
                        </div>
                    }
                />


                <footer className="mt-12 text-center font-sans text-sm text-gray-500 dark:text-gray-400">
                    {t('questions')}{' '}
                    <Link
                        href="/contact"
                        className="rounded font-medium text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green dark:text-emerald-400"
                    >
                        {t('contactSales')}
                    </Link>
                </footer>
            </div>
        </div>
    );
}
