import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache, type ReactElement } from 'react';

import { defaultLocale, type Locale, locales } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { getCategoryMessageKey } from '@/lib/categories';
import { serviceNameFromCapitalLetter } from '@/lib/consts';
import {
    buildProfileCanonicalUrl,
    buildProfileJsonLd,
    buildProfileLanguageAlternates,
    buildProfileTitle,
    serializeJsonLd,
    truncateMetaDescription,
} from '@/lib/service-profile-metadata';
import { getServiceProfile, getSimilarServices } from '@/lib/service-profile-queries';
import type { Socials } from '@/types';

import { env } from '../../../../../env';
import { getHeaderCity, getMainLocation } from './_components/profile-helpers';
import { ProfileFree } from './_components/profile-free/profile-free';
import { toProfileView, toServiceImagePath } from './_components/to-profile-view';

type PageProps = {
    params: Promise<{ locale: string; slug: string }>;
};

function toLocale(value: string): Locale {
    return hasLocale(routing.locales, value) ? value : defaultLocale;
}

/** Jedno zapytanie na zadanie: `generateMetadata` i strona dziela wynik. */
const getCachedServiceProfile = cache(getServiceProfile);

function toSameAs(socials: Socials | null): string[] {
    if (!socials) return [];
    return Object.values(socials).filter(
        (href): href is string => typeof href === 'string' && href.length > 0,
    );
}

function toAbsoluteUrl(baseUrl: string, path: string | null): string | null {
    return path ? `${baseUrl}${path}` : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale: rawLocale, slug } = await params;
    const locale = toLocale(rawLocale);
    setRequestLocale(locale);

    const profile = await getCachedServiceProfile(slug, locale);
    if (!profile) return { robots: { index: false, follow: false } };

    const t = await getTranslations({ locale, namespace: 'ServiceProfile.meta' });
    const tCategories = await getTranslations({ locale, namespace: 'MapPage.Categories' });
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    const view = toProfileView(profile, [], locale);
    const city = getHeaderCity(view);
    const categoryLabel = tCategories(getCategoryMessageKey(profile.category));
    const title = buildProfileTitle({
        name: profile.name,
        categoryLabel,
        city,
        siteName: serviceNameFromCapitalLetter,
    });
    const fallbackDescription = city
        ? t('descriptionLocal', { name: profile.name, category: categoryLabel, city })
        : t('descriptionOnline', { name: profile.name, category: categoryLabel });
    const description = truncateMetaDescription(profile.description ?? fallbackDescription);
    const url = buildProfileCanonicalUrl(baseUrl, locale, slug);
    const imageUrl = toAbsoluteUrl(baseUrl, toServiceImagePath(profile.image));

    return {
        title,
        description,
        alternates: {
            canonical: url,
            languages: buildProfileLanguageAlternates(baseUrl, slug),
        },
        openGraph: {
            title,
            description,
            url,
            type: 'website',
            locale,
            alternateLocale: locales.filter(l => l !== locale),
            siteName: serviceNameFromCapitalLetter,
            images: imageUrl ? [{ url: imageUrl, alt: profile.name }] : undefined,
        },
        robots: { index: true, follow: true },
    };
}

/**
 * Darmowy profil firmy. Bez `<Suspense>` wokol tresci: istnienie slugu sprawdza
 * middleware (prawdziwe 404), a `notFound()` to siatka bezpieczenstwa na wypadek,
 * gdy lookup w middleware zawiodl (fail-open).
 */
export default async function ServiceProfilePage({ params }: PageProps): Promise<ReactElement> {
    const { locale: rawLocale, slug } = await params;
    const locale = toLocale(rawLocale);
    setRequestLocale(locale);

    const profile = await getCachedServiceProfile(slug, locale);
    if (!profile) notFound();

    // Lokalizacje przychodza glowna pierwsza — to miasto glowne, jak `mainCity` w zapytaniu.
    const similarServices = await getSimilarServices(
        {
            serviceId: profile.id,
            category: profile.category,
            city: profile.locations[0]?.city ?? null,
        },
        locale,
    );
    const view = toProfileView(profile, similarServices, locale);
    const mainLocation = getMainLocation(view.locations);
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    const jsonLd = buildProfileJsonLd({
        name: view.name,
        description: view.description,
        url: buildProfileCanonicalUrl(baseUrl, locale, slug),
        imageUrl: toAbsoluteUrl(baseUrl, view.logo),
        coverage: view.coverage,
        location: mainLocation,
        sameAs: toSameAs(mainLocation?.socials ?? null),
    });

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
            />
            <ProfileFree profile={view} />
        </>
    );
}
