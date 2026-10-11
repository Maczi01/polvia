import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { JSX } from 'react';

import { defaultLocale, type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';

import { env } from '../../../../../env';
import { AddBusinessFlow } from './_components/add-business-flow/add-business-flow';
import { addBusinessAlternates, addBusinessUrl } from './add-business-urls';

/**
 * Generowanie szkicu trwa 10–40 s (D6). Akcje z `_actions.ts` dziedzicza konfiguracje
 * segmentu tej strony, wiec limit czasu funkcji ustawiamy tutaj.
 */
export const maxDuration = 60;

interface PageProps {
    params: Promise<{ locale: string }>;
}

function toLocale(value: string): Locale {
    return hasLocale(routing.locales, value) ? value : defaultLocale;
}

export function generateStaticParams(): { locale: Locale }[] {
    return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const locale = toLocale((await params).locale);
    const t = await getTranslations({ locale, namespace: 'addBusiness.page' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    return {
        title: t('metaTitle'),
        description: t('metaDescription'),
        metadataBase: new URL(baseUrl),
        alternates: addBusinessAlternates(baseUrl, locale),
        // Strona indeksowalna (D13): fraza „dodaj firme" ma wartosc SEO.
        robots: { index: true, follow: true },
        openGraph: {
            title: t('metaTitle'),
            description: t('metaDescription'),
            url: addBusinessUrl(baseUrl, locale),
            type: 'website',
            locale,
        },
    };
}

export default async function AddBusinessPage({ params }: PageProps): Promise<JSX.Element> {
    const locale = toLocale((await params).locale);
    setRequestLocale(locale);
    const t = await getTranslations('addBusiness.page');

    return (
        <div className="overflow-y-auto px-4 py-10 sm:px-6">
            <div className="mx-auto w-full max-w-6xl space-y-8">
                <header className="text-center">
                    <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                        {t('title')}
                    </h1>
                    <p className="mx-auto max-w-2xl text-gray-600 dark:text-gray-300">
                        {t('intro')}
                    </p>
                </header>
                <div className="rounded-xl bg-white/70 p-6 shadow-2xl ring-1 ring-gray-100 backdrop-blur dark:bg-gray-800/90 dark:ring-gray-700 sm:p-8">
                    <AddBusinessFlow />
                </div>
            </div>
        </div>
    );
}
