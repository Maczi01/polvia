import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { DirectoryLayout } from '@/components/directory/directory-layout';
import { DirectoryMapClient } from '@/components/directory/directory-map-client';
import { env } from '../../../../../../../env';
import { getServiceLocationsByCityAndCategory, getCategoriesByCity } from '@/lib/seo-queries';
import {
    isValidCitySlug,
    getCityDisplayName,
    getCategoryFromSlug,
    getSlugFromCategory,
    CITY_SLUGS,
    CATEGORY_KEYS,
    type CitySlug,
    type CategoryKey,
} from '@/lib/slug-mappings';
import { categories, mapCategoryToBadgeColor, serviceNameFromCapitalLetter } from '@/lib/consts';
import { Badge } from '@/components/ui/badge/badge';
import { locales } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

type Params = { locale: string; city: string; category: string };

function getCategoryTranslationKey(categoryKey: string): string {
    const cat = categories.find(c => c.key === categoryKey);
    return cat?.text ?? categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
}

export function generateStaticParams() {
    const allParams: Params[] = [];
    for (const locale of locales) {
        for (const city of CITY_SLUGS) {
            for (const categoryKey of CATEGORY_KEYS) {
                const slug = getSlugFromCategory(categoryKey, locale);
                if (slug) {
                    allParams.push({ locale, city, category: slug });
                }
            }
        }
    }
    return allParams;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<Params>;
}): Promise<Metadata> {
    const { locale, city, category: categorySlug } = await params;
    setRequestLocale(locale);

    if (!isValidCitySlug(city)) {
        return { title: 'Not Found', robots: { index: false, follow: false } };
    }

    const categoryKey = getCategoryFromSlug(categorySlug, locale as Locale);
    if (!categoryKey) {
        return { title: 'Not Found', robots: { index: false, follow: false } };
    }

    const t = await getTranslations({ locale, namespace: 'MiastoCategoryPage' });
    const tCategories = await getTranslations({ locale, namespace: 'MapPage.Categories' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    const cityName = getCityDisplayName(city, locale as Locale) ?? city;
    const categoryLabel = tCategories(getCategoryTranslationKey(categoryKey));

    const title = t('metaTitle', { category: categoryLabel, city: cityName });
    const description = t('metaDescription', { category: categoryLabel, city: cityName });

    const pageUrl = locale === 'pl'
        ? `${baseUrl}/miasto/${city}/${categorySlug}`
        : `${baseUrl}/${locale}/miasto/${city}/${categorySlug}`;

    const languagesMap: Record<string, string> = Object.fromEntries([
        ...locales.map(l => {
            const localizedCatSlug = getSlugFromCategory(categoryKey, l) ?? categorySlug;
            return [
                l,
                l === 'pl'
                    ? `${baseUrl}/miasto/${city}/${localizedCatSlug}`
                    : `${baseUrl}/${l}/miasto/${city}/${localizedCatSlug}`,
            ];
        }),
        ['x-default', `${baseUrl}/miasto/${city}/${getSlugFromCategory(categoryKey, 'pl') ?? categorySlug}`],
    ]);

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
        twitter: { card: 'summary_large_image', title, description },
        robots: {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true },
        },
    };
}

export default async function MiastoCategoryPage({ params }: { params: Promise<Params> }) {
    const { locale, city, category: categorySlug } = await params;
    setRequestLocale(locale);

    if (!isValidCitySlug(city)) notFound();

    const categoryKey = getCategoryFromSlug(categorySlug, locale as Locale);
    if (!categoryKey) notFound();

    const citySlug = city as CitySlug;
    const cityName = getCityDisplayName(citySlug, locale as Locale) ?? city;

    const services = await getServiceLocationsByCityAndCategory(citySlug, categoryKey, locale);
    if (services.length === 0) notFound();

    const t = await getTranslations({ locale, namespace: 'MiastoCategoryPage' });
    const tCategories = await getTranslations({ locale, namespace: 'MapPage.Categories' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    const categoryLabel = tCategories(getCategoryTranslationKey(categoryKey));

    // Related categories (other categories in same city, excluding current)
    const allCityCategories = await getCategoriesByCity(citySlug);
    const relatedCategories = allCityCategories.filter(c => c.category !== categoryKey);

    // Map CTA
    const mapCategorySlug = locale === 'pl'
        ? getSlugFromCategory(categoryKey, 'pl')
        : getSlugFromCategory(categoryKey, locale as Locale);
    const mapBase = locale === 'pl' ? '/mapa' : `/${locale}/map`;
    const mapHref = `${mapBase}/${mapCategorySlug}/${city}`;

    // City page link
    const cityHref = locale === 'pl' ? `/miasto/${city}` : `/${locale}/miasto/${city}`;

    // BreadcrumbList + FAQPage structured data
    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Polvia', item: baseUrl },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: cityName,
                    item: locale === 'pl' ? `${baseUrl}/miasto/${city}` : `${baseUrl}/${locale}/miasto/${city}`,
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    name: categoryLabel,
                    item: locale === 'pl'
                        ? `${baseUrl}/miasto/${city}/${categorySlug}`
                        : `${baseUrl}/${locale}/miasto/${city}/${categorySlug}`,
                },
            ],
        },
        {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
                {
                    '@type': 'Question',
                    name: t('faqQ1', { category: categoryLabel, city: cityName }),
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: t('faqA1', { category: categoryLabel, city: cityName }),
                    },
                },
                {
                    '@type': 'Question',
                    name: t('faqQ2', { category: categoryLabel, city: cityName }),
                    acceptedAnswer: {
                        '@type': 'Answer',
                        text: t('faqA2', { category: categoryLabel, city: cityName, count: services.length }),
                    },
                },
            ],
        },
    ];

    const introContent = (
        <>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link href={`/${locale === 'pl' ? '' : locale}`} className="hover:text-foreground transition-colors">
                    {t('breadcrumbHome')}
                </Link>
                <ChevronRight className="size-3.5" />
                <Link href={cityHref} className="hover:text-foreground transition-colors">
                    {cityName}
                </Link>
                <ChevronRight className="size-3.5" />
                <span className="font-medium text-foreground">{categoryLabel}</span>
            </nav>

            {/* H1 + intro */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                    {t('h1', { category: categoryLabel, city: cityName })}
                </h1>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                    {t('intro', { category: categoryLabel, city: cityName })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t('businessCount', { count: services.length })}
                </p>
            </div>

            {/* Back to city */}
            <div className="mb-8">
                <Link
                    href={cityHref}
                    className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-300 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted dark:border-gray-600"
                >
                    <ArrowLeft className="size-4" />
                    {t('backToCity', { city: cityName })}
                </Link>
            </div>
        </>
    );

    const mainContent = (
        <>
            {/* Service Listings */}
            <div className="mb-10">
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
                                    {service.street && (
                                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                                            {service.street}
                                        </p>
                                    )}
                                    {service.verified && (
                                        <span className="mt-1 inline-block rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                                            &#10003;
                                        </span>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Related Categories */}
            {relatedCategories.length > 0 && (
                <div className="mb-10">
                    <h2 className="mb-4 text-lg font-semibold">
                        {t('relatedCategories', { city: cityName })}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {relatedCategories.map(({ category, count }) => {
                            const relLabel = tCategories(getCategoryTranslationKey(category));
                            const relSlug = getSlugFromCategory(category, locale as Locale);
                            const relHref = locale === 'pl'
                                ? `/miasto/${city}/${relSlug}`
                                : `/${locale}/miasto/${city}/${relSlug}`;

                            return (
                                <Link
                                    key={category}
                                    href={relHref}
                                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted dark:border-gray-700"
                                >
                                    <Badge
                                        label={relLabel}
                                        variant={mapCategoryToBadgeColor(category)}
                                    />
                                    <span className="text-xs text-muted-foreground">({count})</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* FAQ */}
            <div className="mb-6">
                <h2 className="mb-4 text-lg font-semibold">{t('faqTitle')}</h2>
                <div className="space-y-4">
                    <div className="rounded-lg border p-4 dark:border-gray-700">
                        <h3 className="font-medium">
                            {t('faqQ1', { category: categoryLabel, city: cityName })}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            {t('faqA1', { category: categoryLabel, city: cityName })}
                        </p>
                    </div>
                    <div className="rounded-lg border p-4 dark:border-gray-700">
                        <h3 className="font-medium">
                            {t('faqQ2', { category: categoryLabel, city: cityName })}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            {t('faqA2', { category: categoryLabel, city: cityName, count: services.length })}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <>
            {structuredData.map((sd, i) => (
                <script
                    key={i}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(sd) }}
                />
            ))}

            <DirectoryLayout
                introContent={introContent}
                mainContent={mainContent}
                map={<DirectoryMapClient services={services} locale={locale} />}
            />
        </>
    );
}
