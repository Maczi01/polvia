import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type JSX, Suspense } from 'react';

import { ContactForm } from '@/app/[locale]/(main)/_components/contact-form';
import { type Locale, toLocale } from '@/i18n/config';
import { routing } from '@/i18n/routing';

import { env } from '../../../../../env';
import { AddBusinessCta } from './_components/add-business-cta/add-business-cta';
import { ContactTabs } from './_components/contact-tabs/contact-tabs';
import { ContactTabsFromQuery } from './_components/contact-tabs/contact-tabs-from-query';
import { DEFAULT_CONTACT_TAB } from './contact-tab';
import { contactAlternates } from './contact-urls';

interface PageProps {
    params: Promise<{ locale: string }>;
}

export function generateStaticParams(): { locale: Locale }[] {
    return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const locale = toLocale((await params).locale);
    const t = await getTranslations({ locale, namespace: 'Metadata' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    return {
        title: t('contactPage'),
        description: t('contactDescription'),
        metadataBase: new URL(baseUrl),
        alternates: contactAlternates(baseUrl, locale),
        robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    };
}

export default async function ContactPage({ params }: PageProps): Promise<JSX.Element> {
    const locale = toLocale((await params).locale);
    setRequestLocale(locale);
    const t = await getTranslations('ContactPage');
    const business = <AddBusinessCta />;

    return (
        <div className="overflow-y-auto px-4 py-10 sm:px-6">
            <div className="mx-auto w-full max-w-4xl rounded-xl bg-white/70 p-6 shadow-2xl ring-1 ring-gray-100 backdrop-blur dark:bg-gray-800/90 dark:ring-gray-700 sm:p-8 md:p-10">
                <header className="mb-8 text-center">
                    <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        {t('title')}
                    </h1>
                    <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-300">
                        {t('subtitle')}
                    </p>
                </header>
                {/* Zakladka i wypelnienie z query bez czytania `searchParams` (strona statyczna). */}
                <Suspense
                    fallback={
                        <ContactTabs
                            defaultTab={DEFAULT_CONTACT_TAB}
                            business={business}
                            question={<ContactForm />}
                        />
                    }
                >
                    <ContactTabsFromQuery business={business} />
                </Suspense>
            </div>
        </div>
    );
}
