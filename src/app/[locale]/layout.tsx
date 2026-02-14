import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';
import { locales } from '@/i18n/config';
import { notFound } from 'next/navigation';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Newsletter } from '@/components/newsletter';
import { ThemeProviderWrapper } from '@/providers/theme-provider-wrapper';
import Script from 'next/script';
import { env } from '../../../env';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { serviceName, serviceNameFromCapitalLetter } from '@/lib/consts';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
    display: 'swap',
    preload: true,
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
    display: 'swap',
    preload: false, // Only preload primary font
});

export async function generateMetadata({
                                           params,
                                       }: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations('Metadata');
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    return {
        title: t('title'),
        description: t('description'),
        metadataBase: new URL(baseUrl),
        alternates: {
            // This will be the canonical for homepage
            canonical: locale === 'pl' ? baseUrl : `${baseUrl}/${locale}`,
            languages: {
                'x-default': baseUrl, // Root domain serves Polish
                pl: baseUrl, // Polish gets root domain
                en: `${baseUrl}/en`,
            },
        },
        openGraph: {
            title: t('title'),
            description: t('description'),
            url: locale === 'pl' ? baseUrl : `${baseUrl}/${locale}`,
            type: 'website',
            locale,
            alternateLocale: locale === 'en' ? 'pl' : 'en',
            siteName: serviceNameFromCapitalLetter,
        },
        twitter: {
            card: 'summary_large_image',
            title: t('title'),
            description: t('description'),
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
            },
        },
    };
}

export default async function RootLayout({
                                             children,
                                             params,
                                         }: Readonly<{
    children: ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;
    if (!locales.includes(locale as any)) {
        notFound();
    }
    setRequestLocale(locale);
    const messages = await getMessages({ locale });
    const t = await getTranslations('Metadata');

    const organizationSchema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "name": serviceNameFromCapitalLetter,
                "description": t('description'),
                "url": env.NEXT_PUBLIC_SITE_URL,
                "logo": `${env.NEXT_PUBLIC_SITE_URL}/logo/logo.svg`,
                "areaServed": [
                    {
                        "@type": "Country",
                        "name": "Ireland"
                    },
                    {
                        "@type": "Country",
                        "name": "Northern Ireland"
                    }
                ],
                "knowsLanguage": ["pl", "en"],
                "mainEntityOfPage": {
                    "@type": "WebPage",
                    "@id": env.NEXT_PUBLIC_SITE_URL
                }
            },
            {
                "@type": "WebSite",
                "name": serviceNameFromCapitalLetter,
                "description": t('description'),
                "url": env.NEXT_PUBLIC_SITE_URL,
                "inLanguage": [locale],
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                        "@type": "EntryPoint",
                        "urlTemplate": `${env.NEXT_PUBLIC_SITE_URL}/map?query={search_term_string}`
                    },
                    "query-input": "required name=search_term_string"
                }
            }
        ]
    };

    return (
        <html lang={locale} className="h-full" suppressHydrationWarning>
            <head>
                <Script
                    id="clarity-script"
                    strategy="afterInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
                 (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${env.CLARITY_PROJECT_ID}");
            `,
                }}
            />

            {/* Schema.org Structured Data */}
            <Script
                id="organization-schema"
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(organizationSchema),
                }}
            />
        </head>
        <body
            className={`${geistSans.variable} ${geistMono.variable} h-full bg-[#F6F6F7] antialiased transition-colors dark:bg-gray-900`}
        >
        <ThemeProviderWrapper>
            <NextIntlClientProvider locale={locale} messages={messages}>
                <NuqsAdapter>{children}</NuqsAdapter>
                <Newsletter position="bottom-left" />
                <CookieConsentBanner />
            </NextIntlClientProvider>
        </ThemeProviderWrapper>
        <SpeedInsights />
        </body>
        </html>
    );
}
