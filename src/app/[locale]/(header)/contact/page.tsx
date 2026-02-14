// app/[locale]/contact/page.tsx

import { ContactForm } from '@/app/[locale]/(main)/_components/contact-form';
import { Header } from '@/components/header/header';
import { getTranslations, setRequestLocale } from 'next-intl/server'; // Add setRequestLocale
import { Metadata } from 'next';
import { env } from '../../../../../env';

export async function generateStaticParams() {
    return ['en', 'pl', 'ru', 'uk'].map(locale => ({
        locale,
    }));
}

export async function generateMetadata({
                                            params
                                        }: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations("Metadata");
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    // Handle the different paths
    const contactPath = locale === 'en' ? 'contact' : 'kontakt';

    return {
        title: t('contactPage'),
        description: t('contactDescription'),
        metadataBase: new URL(baseUrl),
        alternates: {
            canonical: `${baseUrl}/${locale}/${contactPath}`, // Dynamic path
            languages: {
                'x-default': `${baseUrl}/pl/kontakt`, // English default
                en: `${baseUrl}/en/contact`,
                pl: `${baseUrl}/pl/kontakt`, // Polish localized
            },
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

export default async function ContactPage({ // Add async and params
                                              params,
                                          }: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale); // Add this line

    return (
        <div className="overflow-y-auto px-4 py-10 sm:px-6">
            <ContactForm />
        </div>
    );
}
