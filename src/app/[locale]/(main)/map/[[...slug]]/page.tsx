import { ServicesLoadingSkeleton } from '@/app/[locale]/(main)/_components/services-loading-skeleton';
import { Suspense } from 'react';
import { MapPageClient } from '@/app/[locale]/(main)/_components/map-page-client';
import ServicesContent from '@/app/[locale]/(main)/_components/services-content';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { env } from '../../../../../../env';
import { Metadata } from 'next';
import { serviceNameFromCapitalLetter } from '@/lib/consts';
import { parseMapSlug, extractFiltersFromQueryParams } from '@/lib/map-slug-parser';
import { buildMapUrl, stringifyMapUrl, localizeMapPath } from '@/lib/map-url-builder';
import { redirect, notFound } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

type PageProps = {
    params: Promise<{ locale: string; slug?: string[] }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    const resolvedSearchParams = await searchParams;
    setRequestLocale(locale);

    const t = await getTranslations('MapPage');
    const tCategories = await getTranslations('MapPage.Categories');
    const tCounties = await getTranslations('MapPage.counties');
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    // Handle the localized path
    const mapPath = locale === 'pl' ? 'mapa' : 'map';
    const localePrefix = locale === 'pl' ? '' : `/${locale}`;

    // Parse slug to get filters
    const parseResult = parseMapSlug(slug, locale as Locale, `${localePrefix}/${mapPath}`);

    let canonicalPath = `${localePrefix}/${mapPath}`;
    let titleSuffix = '';

    if (parseResult.success) {
        const { category, county } = parseResult.filters;

        // Build slug path for canonical URL
        if (category || county) {
            const slugUrl = buildMapUrl({ category, county }, locale as Locale);
            canonicalPath = `${localePrefix}${localizeMapPath(slugUrl.pathname, locale as Locale)}`;

            // Build title suffix with translations
            const parts: string[] = [];
            if (category) {
                // Capitalize first letter of category for display
                const categoryKey = category.charAt(0).toUpperCase() + category.slice(1);
                parts.push(tCategories(categoryKey));
            }
            if (county) {
                // Counties keys are lowercase with hyphens
                const countyTranslation = tCounties(county, { defaultValue: county });
                parts.push(countyTranslation);
            }
            titleSuffix = parts.length > 0 ? ` - ${parts.join(', ')}` : '';
        }
    }

    const canonicalUrl = `${baseUrl}${canonicalPath}`;

    // Build language alternates with proper slug translations
    const languageUrls: Record<string, string> = {
        pl: `${baseUrl}/mapa`,
        en: `${baseUrl}/en/map`,
        ru: `${baseUrl}/ru/map`,
        uk: `${baseUrl}/uk/map`,
    };

    if (parseResult.success) {
        const { category, county } = parseResult.filters;
        if (category || county) {
            for (const loc of locales) {
                const slugUrl = buildMapUrl({ category, county }, loc);
                const prefix = loc === 'pl' ? '' : `/${loc}`;
                languageUrls[loc] = `${baseUrl}${prefix}${localizeMapPath(slugUrl.pathname, loc)}`;
            }
        }
    }

    return {
        title: `${t('title')}${titleSuffix}`,
        description: t('description'),
        alternates: {
            canonical: canonicalUrl,
            languages: languageUrls,
        },
        openGraph: {
            title: `${t('title')}${titleSuffix}`,
            description: t('description'),
            url: canonicalUrl,
            type: 'website',
            locale,
            alternateLocale: locales.filter(l => l !== locale),
            siteName: serviceNameFromCapitalLetter,
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

export default async function MapPage(props: PageProps) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const { locale, slug } = params;
    setRequestLocale(locale);

    const mapPath = locale === 'pl' ? 'mapa' : 'map';
    const localePrefix = locale === 'pl' ? '' : `/${locale}`;
    const basePath = `${localePrefix}/${mapPath}`;

    // Handle legacy /_/ URLs → redirect to clean canonical URLs (301)
    // e.g. /map/_/tyrone → /map/tyrone, /mapa/_/down → /mapa/down
    if (slug && slug.length >= 2 && slug[0] === '_') {
        const countySlug = slug[1];
        const newUrl = buildMapUrl({ county: countySlug }, locale as Locale);
        const localizedUrl = localizeMapPath(stringifyMapUrl(newUrl), locale as Locale);
        redirect(`${localePrefix}${localizedUrl}`);
    }

    // Check for old query-based URLs and redirect to slug-based URLs
    if (searchParams.category || searchParams.county) {
        const oldFilters = extractFiltersFromQueryParams({
            category: searchParams.category,
            county: searchParams.county,
        });

        const newUrl = buildMapUrl(
            {
                category: oldFilters.category,
                county: oldFilters.county,
                query: searchParams.query as string | undefined,
                slug: searchParams.slug as string | undefined,
                view: searchParams.view as 'map' | 'list' | undefined,
            },
            locale as Locale,
        );

        const localizedUrl = localizeMapPath(stringifyMapUrl(newUrl), locale as Locale);
        redirect(`${localePrefix}${localizedUrl}`);
    }

    // Parse slug-based route
    const parseResult = parseMapSlug(slug, locale as Locale, basePath);

    // If parsing failed, return 404
    if (!parseResult.success) {
        notFound();
    }

    return (
        <div className="flex size-full flex-col relative">
            <Suspense fallback={<ServicesLoadingSkeleton />}>
                <MapPageClientWrapper params={params} initialFilters={parseResult.filters} />
            </Suspense>
        </div>
    );
}

async function MapPageClientWrapper({
    params,
    initialFilters,
}: {
    params: { locale: string; slug?: string[] };
    initialFilters?: any;
}) {
    const services = await ServicesContent({ params });
    return <MapPageClient services={services} initialFilters={initialFilters} />;
}
