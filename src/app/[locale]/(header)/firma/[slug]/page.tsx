import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import {
    MapPin,
    Phone,
    Mail,
    Globe,
    Clock,
    ChevronRight,
    ExternalLink,
} from 'lucide-react';
import { DirectoryLayout } from '@/components/directory/directory-layout';
import { DirectoryMapClient } from '@/components/directory/directory-map-client';
import { env } from '../../../../../../env';
import { getServiceLocationBySlug, getRelatedServiceLocations, getAllActiveServiceLocationSlugs } from '@/lib/seo-queries';
import {
    normalizeCityFromRaw,
    getCityDisplayName,
    getSlugFromCategory,
} from '@/lib/slug-mappings';
import {
    mapCategoryToBadgeColor,
    formatAddress,
    serviceNameFromCapitalLetter,
    VOIVODESHIP_TO_MESSAGE_KEY,
} from '@/lib/consts';
import { categories } from '@/lib/consts';
import { Badge } from '@/components/ui/badge/badge';
import { locales } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

type Params = { locale: string; slug: string };

export async function generateStaticParams() {
    const locations = await getAllActiveServiceLocationSlugs();
    return locations.flatMap(loc =>
        locales.map(locale => ({ locale, slug: loc.slug })),
    );
}

function getCategoryTranslationKey(categoryKey: string): string {
    const cat = categories.find(c => c.key === categoryKey);
    return cat?.text ?? categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
}

const DAY_KEYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function getDayKeyFromDate(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<Params>;
}): Promise<Metadata> {
    const { locale, slug } = await params;
    setRequestLocale(locale);

    const service = await getServiceLocationBySlug(slug, locale);
    if (!service) {
        return { title: 'Not Found', robots: { index: false, follow: false } };
    }

    const t = await getTranslations({ locale, namespace: 'FirmaPage' });
    const tCategories = await getTranslations({ locale, namespace: 'MapPage.Categories' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    const categoryLabel = tCategories(getCategoryTranslationKey(service.category));
    const citySlug = service.city ? normalizeCityFromRaw(service.city) : null;
    const cityName = citySlug
        ? getCityDisplayName(citySlug, locale as Locale)
        : service.city;

    const title = cityName
        ? t('metaTitle', { name: service.name, category: categoryLabel, city: cityName })
        : t('metaTitleNoCity', { name: service.name, category: categoryLabel });

    const description = cityName
        ? t('metaDescription', { name: service.name, category: categoryLabel, city: cityName })
        : t('metaDescriptionNoCity', { name: service.name, category: categoryLabel });

    const pageUrl = locale === 'pl'
        ? `${baseUrl}/firma/${slug}`
        : `${baseUrl}/${locale}/firma/${slug}`;

    const languagesMap: Record<string, string> = {
        ...Object.fromEntries(
            locales.map(l => [
                l,
                l === 'pl' ? `${baseUrl}/firma/${slug}` : `${baseUrl}/${l}/firma/${slug}`,
            ]),
        ),
        'x-default': `${baseUrl}/firma/${slug}`,
    };

    const ogImg = service.image
        ? `${baseUrl}/services/${service.image}`
        : undefined;

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
            images: ogImg ? [{ url: ogImg, width: 1200, height: 630, alt: service.name }] : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: ogImg ? [ogImg] : undefined,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: { index: true, follow: true },
        },
    };
}

export default async function FirmaPage({ params }: { params: Promise<Params> }) {
    const { locale, slug } = await params;
    setRequestLocale(locale);

    const service = await getServiceLocationBySlug(slug, locale);
    if (!service) notFound();

    const t = await getTranslations({ locale, namespace: 'FirmaPage' });
    const tCategories = await getTranslations({ locale, namespace: 'MapPage.Categories' });
    const tCard = await getTranslations({ locale, namespace: 'MapCard' });
    const tVerified = await getTranslations({ locale, namespace: 'VerifiedBadge' });

    const baseUrl = env.NEXT_PUBLIC_SITE_URL;
    const categoryLabel = tCategories(getCategoryTranslationKey(service.category));
    const categoryBadgeColor = mapCategoryToBadgeColor(service.category);
    const citySlug = service.city ? normalizeCityFromRaw(service.city) : null;
    const cityName = citySlug
        ? getCityDisplayName(citySlug, locale as Locale)
        : service.city;

    const address = formatAddress({
        street: service.street,
        postcode: service.postcode,
        city: service.city,
        voivodeship: service.voivodeship
            ? VOIVODESHIP_TO_MESSAGE_KEY[service.voivodeship] ?? service.voivodeship
            : null,
    });

    const related = await getRelatedServiceLocations(
        service.id,
        service.category,
        service.city,
        locale,
        6,
    );

    const today = getDayKeyFromDate(new Date());
    const todayHours = service.openingHours?.[today];

    // Map CTA link
    const categorySlug = getSlugFromCategory(service.category, locale as Locale);
    const mapHref = locale === 'pl' ? '/mapa' : `/${locale}/map`;
    const mapWithPlace = `${mapHref}${categorySlug ? `/${categorySlug}` : ''}?place=${service.slug}`;

    // Structured data — LocalBusiness
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: service.name,
        description: service.description ?? undefined,
        ...(address && {
            address: {
                '@type': 'PostalAddress',
                streetAddress: service.street ?? undefined,
                addressLocality: service.city ?? undefined,
                postalCode: service.postcode ?? undefined,
                addressRegion: service.voivodeship ?? undefined,
                addressCountry: 'PL',
            },
        }),
        ...(service.phoneNumber && { telephone: service.phoneNumber }),
        ...(service.webpage && { url: service.webpage }),
        geo: {
            '@type': 'GeoCoordinates',
            latitude: service.latitude,
            longitude: service.longitude,
        },
        ...(service.image && {
            image: `${baseUrl}/services/${service.image}`,
        }),
    };

    // Structured data — BreadcrumbList
    const homeUrl = locale === 'pl' ? baseUrl : `${baseUrl}/${locale}`;
    const breadcrumbItems: { name: string; item?: string }[] = [
        { name: t('breadcrumbHome'), item: homeUrl },
    ];
    if (citySlug && cityName) {
        breadcrumbItems.push({
            name: cityName,
            item: locale === 'pl' ? `${baseUrl}/miasto/${citySlug}` : `${baseUrl}/${locale}/miasto/${citySlug}`,
        });
    }
    if (citySlug && categorySlug) {
        breadcrumbItems.push({
            name: categoryLabel,
            item: locale === 'pl'
                ? `${baseUrl}/miasto/${citySlug}/${categorySlug}`
                : `${baseUrl}/${locale}/miasto/${citySlug}/${categorySlug}`,
        });
    }
    breadcrumbItems.push({ name: service.name });

    const breadcrumbStructuredData = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            ...(item.item && { item: item.item }),
        })),
    };

    // Build map services: main service + related
    const mapServices = [service, ...related] as unknown as import('@/types').PartialService[];

    const introContent = (
        <>
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link href={`/${locale === 'pl' ? '' : locale}`} className="hover:text-foreground transition-colors">
                    {t('breadcrumbHome')}
                </Link>
                {citySlug && cityName && (
                    <>
                        <ChevronRight className="size-3.5" />
                        <Link
                            href={locale === 'pl' ? `/miasto/${citySlug}` : `/${locale}/miasto/${citySlug}`}
                            className="hover:text-foreground transition-colors"
                        >
                            {cityName}
                        </Link>
                    </>
                )}
                <ChevronRight className="size-3.5" />
                {citySlug && categorySlug ? (
                    <Link
                        href={locale === 'pl' ? `/miasto/${citySlug}/${categorySlug}` : `/${locale}/miasto/${citySlug}/${categorySlug}`}
                        className="hover:text-foreground transition-colors"
                    >
                        {categoryLabel}
                    </Link>
                ) : (
                    <span>{categoryLabel}</span>
                )}
                <ChevronRight className="size-3.5" />
                <span className="text-foreground font-medium truncate max-w-[200px]">{service.name}</span>
            </nav>

            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
                        <Image
                            src={service.image ? `/services/${service.image}` : '/default.png'}
                            alt={service.name}
                            fill
                            className="object-cover"
                            sizes="96px"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge label={categoryLabel} variant={categoryBadgeColor} />
                            {service.verified && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                                    {tVerified('text')}
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            {service.name}
                        </h1>
                        {cityName && (
                            <p className="mt-1 text-muted-foreground">
                                {cityName}
                                {service.voivodeship && `, ${VOIVODESHIP_TO_MESSAGE_KEY[service.voivodeship] ?? service.voivodeship}`}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );

    const mainContent = (
        <>
            {/* Info Grid */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
                {address && (
                    <InfoItem icon={<MapPin className="size-4" />} label={t('address')} value={address} />
                )}
                {service.phoneNumber && (
                    <InfoItem
                        icon={<Phone className="size-4" />}
                        label={t('phone')}
                        value={service.phoneNumber}
                        href={`tel:${service.phoneNumber}`}
                    />
                )}
                {service.email && (
                    <InfoItem
                        icon={<Mail className="size-4" />}
                        label={t('email')}
                        value={service.email}
                        href={`mailto:${service.email}`}
                    />
                )}
                {service.webpage && (
                    <InfoItem
                        icon={<Globe className="size-4" />}
                        label={t('website')}
                        value={new URL(service.webpage.startsWith('http') ? service.webpage : `https://${service.webpage}`).hostname}
                        href={service.webpage.startsWith('http') ? service.webpage : `https://${service.webpage}`}
                        external
                    />
                )}
                {service.languages && service.languages.length > 0 && (
                    <InfoItem
                        icon={<Globe className="size-4" />}
                        label={t('languages')}
                        value={service.languages.map(l => l.toUpperCase()).join(', ')}
                    />
                )}
                {todayHours && (
                    <InfoItem
                        icon={<Clock className="size-4" />}
                        label={`${t('openingHours')} (${tCard('today')})`}
                        value={`${todayHours.open} – ${todayHours.close}`}
                    />
                )}
            </div>

            {/* Opening Hours Full Table */}
            {service.openingHours && Object.keys(service.openingHours).length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold">{t('openingHours')}</h2>
                    <div className="overflow-hidden rounded-lg border dark:border-gray-700">
                        <table className="w-full text-sm">
                            <tbody>
                                {DAY_KEYS.map(day => {
                                    const hours = service.openingHours?.[day];
                                    const isToday = day === today;
                                    return (
                                        <tr
                                            key={day}
                                            className={`border-b last:border-b-0 dark:border-gray-700 ${isToday ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                                        >
                                            <td className={`px-4 py-2.5 ${isToday ? 'font-semibold' : ''}`}>
                                                {tCard(day)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-muted-foreground">
                                                {hours ? `${hours.open} – ${hours.close}` : t('closed')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Description */}
            {service.description && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold">{t('description')}</h2>
                    <p className="leading-relaxed text-muted-foreground whitespace-pre-line">
                        {service.description}
                    </p>
                </div>
            )}

            {/* Tags */}
            {service.tags && service.tags.length > 0 && (
                <div className="mb-8 flex flex-wrap gap-2">
                    {service.tags.map(tag => (
                        <span
                            key={tag}
                            className="rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground dark:border-gray-700"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Related Services */}
            {related.length > 0 && (
                <div>
                    <h2 className="mb-4 text-xl font-semibold">{t('relatedServices')}</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {related.map(r => {
                            const rCitySlug = r.city ? normalizeCityFromRaw(r.city) : null;
                            const rCityName = rCitySlug
                                ? getCityDisplayName(rCitySlug, locale as Locale)
                                : r.city;
                            const rHref = locale === 'pl'
                                ? `/firma/${r.slug}`
                                : `/${locale}/firma/${r.slug}`;

                            return (
                                <Link
                                    key={r.id}
                                    href={rHref}
                                    className="group flex items-start gap-3 rounded-xl border p-3 transition-all hover:shadow-md dark:border-gray-700 dark:hover:border-gray-600"
                                >
                                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                        <Image
                                            src={r.image ? `/services/${r.image}` : '/default.png'}
                                            alt={r.name}
                                            fill
                                            className="object-cover"
                                            sizes="48px"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium leading-snug group-hover:text-green-600 truncate">
                                            {r.name}
                                        </p>
                                        {rCityName && (
                                            <p className="text-sm text-muted-foreground truncate">{rCityName}</p>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
            />

            <DirectoryLayout
                introContent={introContent}
                mainContent={mainContent}
                map={
                    <DirectoryMapClient
                        services={mapServices}
                        highlightedServiceId={service.id}
                        locale={locale}
                    />
                }
            />
        </>
    );
}

function InfoItem({
    icon,
    label,
    value,
    href,
    external,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    href?: string;
    external?: boolean;
}) {
    const content = (
        <div className="flex items-start gap-3 rounded-lg border p-3 dark:border-gray-700">
            <div className="mt-0.5 text-muted-foreground">{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-sm font-medium break-words">{value}</p>
            </div>
            {external && <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
        </div>
    );

    if (href) {
        return (
            <a
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                className="transition-colors hover:bg-muted/50 rounded-lg"
            >
                {content}
            </a>
        );
    }

    return content;
}
