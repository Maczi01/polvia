import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { ProfileHref } from '@/app/[locale]/firma/[slug]/_components/service-profile-types';
import { toLocale } from '@/i18n/config';
import { premiumContactQuery } from '@/lib/premium-contact';
import { isStripeConfigured } from '@/lib/stripe';

import { PremiumExample } from './_components/premium-example/premium-example';
import {
    EXAMPLE_TEMPLATE_PARAM,
    getPremiumExampleProfile,
    parseExampleTemplate,
} from './_components/premium-example-profile';

type PageProps = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Zakup premium z przykladu: przy platnosciach online `/cennik` (tam instrukcja „znajdz swoja
 * firme”), bez nich formularz kontaktowy z tematem premium — bez slugu, bo przyklad nie jest
 * firma (`readContactPrefill` przyjmuje sam temat).
 */
const EXAMPLE_CTA_HREF: ProfileHref = isStripeConfigured
    ? '/pricing'
    : { pathname: '/contact', query: premiumContactQuery() };

/**
 * Fikcyjna firma nie moze trafic do wyszukiwarki: `noindex` (linki z paska prowadza do
 * prawdziwych stron, wiec `follow`). Strony nie ma tez w sitemapie ani na mapie.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const locale = toLocale((await params).locale);
    const t = await getTranslations({ locale, namespace: 'ServiceProfile.example' });

    return {
        title: t('metaTitle'),
        description: t('metaDescription'),
        robots: { index: false, follow: true },
    };
}

export default async function PremiumExamplePage({
    params,
    searchParams,
}: PageProps): Promise<ReactElement> {
    const locale = toLocale((await params).locale);
    setRequestLocale(locale);
    const template = parseExampleTemplate((await searchParams)[EXAMPLE_TEMPLATE_PARAM]);

    // Bez JSON-LD: dane strukturalne fikcyjnej firmy bylyby falszywym wpisem dla Google.
    return (
        <PremiumExample
            profile={getPremiumExampleProfile(locale, template)}
            ctaHref={EXAMPLE_CTA_HREF}
        />
    );
}
