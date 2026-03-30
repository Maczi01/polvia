import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { DirectoryLayout } from '@/components/directory/directory-layout';
import { DirectoryMapClient } from '@/components/directory/directory-map-client';
import { env } from '../../../../../../env';
import { getServiceLocationsByCity, getCategoriesByCity } from '@/lib/seo-queries';
import {
    isValidCitySlug,
    getCityDisplayName,
    getSlugFromCategory,
    CITY_SLUGS,
    CITIES,
    type CitySlug,
} from '@/lib/slug-mappings';
import { categories, mapCategoryToBadgeColor, serviceNameFromCapitalLetter } from '@/lib/consts';
import { Badge } from '@/components/ui/badge/badge';
import { locales } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

type Params = { locale: string; city: string };

function getCategoryTranslationKey(categoryKey: string): string {
    const cat = categories.find(c => c.key === categoryKey);
    return cat?.text ?? categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
}

function getCategoryIcon(categoryKey: string): string | undefined {
    return categories.find(c => c.key === categoryKey)?.image;
}

export function generateStaticParams() {
    const allParams: Params[] = [];
    for (const locale of locales) {
        for (const city of CITY_SLUGS) {
            allParams.push({ locale, city });
        }
    }
    return allParams;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<Params>;
}): Promise<Metadata> {
    const { locale, city } = await params;
    setRequestLocale(locale);

    if (!isValidCitySlug(city)) {
        return { title: 'Not Found', robots: { index: false, follow: false } };
    }

    const t = await getTranslations({ locale, namespace: 'MiastoPage' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;
    const cityName = getCityDisplayName(city, locale as Locale) ?? city;

    const title = t('metaTitle', { city: cityName });
    const description = t('metaDescription', { city: cityName });

    const pageUrl = locale === 'pl'
        ? `${baseUrl}/miasto/${city}`
        : `${baseUrl}/${locale}/miasto/${city}`;

    const languagesMap: Record<string, string> = {
        ...Object.fromEntries(
            locales.map(l => [
                l,
                l === 'pl' ? `${baseUrl}/miasto/${city}` : `${baseUrl}/${l}/miasto/${city}`,
            ]),
        ),
        'x-default': `${baseUrl}/miasto/${city}`,
    };

    return {
        title,
        description,
        alternates: {
            canonical: pageUrl,
            languages: languagesMap,
        },
        openGraph: {
            title,
            description,
            url: pageUrl,
            type: 'website',
            locale,
            alternateLocale: locales.filter(l => l !== locale),
            siteName: serviceNameFromCapitalLetter,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true },
        },
    };
}

export default async function MiastoPage({ params }: { params: Promise<Params> }) {
    const { locale, city } = await params;
    setRequestLocale(locale);

    if (!isValidCitySlug(city)) notFound();

    const citySlug = city as CitySlug;
    const cityName = getCityDisplayName(citySlug, locale as Locale) ?? city;

    const [services, cityCategories] = await Promise.all([
        getServiceLocationsByCity(citySlug, locale),
        getCategoriesByCity(citySlug),
    ]);

    if (services.length === 0) notFound();

    const t = await getTranslations({ locale, namespace: 'MiastoPage' });
    const tCategories = await getTranslations({ locale, namespace: 'MapPage.Categories' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    // Map CTA — link to map filtered by city
    const mapHref = locale === 'pl'
        ? `/mapa/${city}`
        : `/${locale}/map/${city}`;

    // BreadcrumbList structured data
    const breadcrumbData = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Polvia',
                item: baseUrl,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: cityName,
                item: locale === 'pl'
                    ? `${baseUrl}/miasto/${city}`
                    : `${baseUrl}/${locale}/miasto/${city}`,
            },
        ],
    };

    const introContent = (
        <>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link href={`/${locale === 'pl' ? '' : locale}`} className="hover:text-foreground transition-colors">
                    {t('breadcrumbHome')}
                </Link>
                <ChevronRight className="size-3.5" />
                <span className="font-medium text-foreground">{cityName}</span>
            </nav>

            {/* H1 + intro */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                    {t('h1', { city: cityName })}
                </h1>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                    {t('intro', { city: cityName })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t('businessCount', { count: services.length })}
                </p>
            </div>

            {/* Top Categories Grid */}
            {cityCategories.length > 0 && (
                <div className="mb-10">
                    <h2 className="mb-4 text-xl font-semibold">{t('topCategories')}</h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {cityCategories.map(({ category, count }) => {
                            const categoryLabel = tCategories(getCategoryTranslationKey(category));
                            const categorySlug = getSlugFromCategory(category, locale as Locale);
                            const icon = getCategoryIcon(category);
                            const href = locale === 'pl'
                                ? `/miasto/${city}/${categorySlug}`
                                : `/${locale}/miasto/${city}/${categorySlug}`;

                            return (
                                <Link
                                    key={category}
                                    href={href}
                                    className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-md dark:border-gray-700 dark:hover:border-gray-600"
                                >
                                    {icon && (
                                        <Image
                                            src={icon}
                                            alt=""
                                            width={24}
                                            height={24}
                                            className="size-6 shrink-0"
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium leading-snug group-hover:text-green-600 truncate">
                                            {categoryLabel}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{count}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );

    const mainContent = (
        <div>
            <h2 className="mb-4 text-xl font-semibold">
                {t('allBusinesses', { city: cityName })}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
                {services.map(service => {
                    const firmaHref = locale === 'pl'
                        ? `/firma/${service.slug}`
                        : `/${locale}/firma/${service.slug}`;

                    return (
                        <Link
                            key={service.id}
                            href={firmaHref}
                            className="group flex items-start gap-3 rounded-xl border p-4 transition-all hover:shadow-md dark:border-gray-700 dark:hover:border-gray-600"
                        >
                            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                                <Image
                                    src={service.image ? `/services/${service.image}` : '/default.png'}
                                    alt={service.name}
                                    fill
                                    className="object-cover"
                                    sizes="56px"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium leading-snug group-hover:text-green-600 truncate">
                                    {service.name}
                                </p>
                                <Badge
                                    label={tCategories(getCategoryTranslationKey(service.category))}
                                    variant={mapCategoryToBadgeColor(service.category)}
                                />
                                {service.street && (
                                    <p className="mt-1 text-xs text-muted-foreground truncate">
                                        {service.street}
                                    </p>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
            />

            <DirectoryLayout
                introContent={introContent}
                mainContent={mainContent}
                map={<DirectoryMapClient services={services} locale={locale} />}
            />
        </>
    );
}
