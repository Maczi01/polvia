import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { cache, type ComponentType, type ReactElement } from 'react';

import { defaultLocale, type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { getCategoryMessageKey } from '@/lib/categories';
import { serviceNameFromCapitalLetter } from '@/lib/consts';
import type { PremiumTemplate } from '@/lib/premium-templates';
import {
    buildProfileCanonicalUrl,
    buildProfileJsonLd,
    buildProfileMetadata,
    serializeJsonLd,
    toAbsoluteUrl,
} from '@/lib/service-profile-metadata';
import {
    getServiceProfile,
    getSimilarServices,
    type ServiceProfile,
} from '@/lib/service-profile-queries';

import { env } from '../../../../../env';
import { getHeaderCity, getMainLocation, toSameAs } from './_components/profile-helpers';
import { ProfileFree } from './_components/profile-free/profile-free';
import {
    type ProfileViewKind,
    selectOgCoverPath,
    selectProfileView,
    shouldLoadSimilarServices,
    toPremiumProfileView,
} from './_components/select-profile-view';
import type { PremiumProfileView, ServiceProfileView } from './_components/service-profile-types';
import { TemplateClassic } from './_components/template-classic/template-classic';
import { TemplateGallery } from './_components/template-gallery/template-gallery';
import { TemplateProfessional } from './_components/template-professional/template-professional';
import { toProfileView, toServiceImagePath } from './_components/to-profile-view';

type PageProps = {
    params: Promise<{ locale: string; slug: string }>;
};

function toLocale(value: string): Locale {
    return hasLocale(routing.locales, value) ? value : defaultLocale;
}

/** Jedno zapytanie na zadanie: `generateMetadata` i strona dziela wynik. */
const getCachedServiceProfile = cache(getServiceProfile);

/**
 * Jedna chwila na zadanie: na granicy karencji `generateMetadata` i strona musza podjac
 * te sama decyzje widoku, inaczej cover premium trafilby do OG strony free (albo odwrotnie).
 */
const getRequestNow = cache((): Date => new Date());

/** Ta sama decyzja widoku dla strony i `generateMetadata`. */
function resolveProfileView(profile: ServiceProfile): ProfileViewKind {
    return selectProfileView({
        premiumContent: profile.premiumContent,
        subscription: profile.subscription,
        now: getRequestNow(),
    });
}

const PREMIUM_TEMPLATE_COMPONENTS: Record<
    PremiumTemplate,
    ComponentType<{ profile: PremiumProfileView }>
> = {
    gallery: TemplateGallery,
    professional: TemplateProfessional,
    classic: TemplateClassic,
};

function ProfileView({
    view,
    viewKind,
}: {
    view: ServiceProfileView;
    viewKind: ProfileViewKind;
}): ReactElement {
    if (viewKind.kind === 'free') return <ProfileFree profile={view} />;

    const Template = PREMIUM_TEMPLATE_COMPONENTS[viewKind.template];
    return <Template profile={toPremiumProfileView(view)} />;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale: rawLocale, slug } = await params;
    const locale = toLocale(rawLocale);
    setRequestLocale(locale);

    const profile = await getCachedServiceProfile(slug, locale);
    if (!profile) return buildProfileMetadata(null);

    const t = await getTranslations({ locale, namespace: 'ServiceProfile.meta' });
    const tCategories = await getTranslations({ locale, namespace: 'MapPage.Categories' });

    const city = getHeaderCity(profile);
    const viewKind = resolveProfileView(profile);
    const categoryLabel = tCategories(getCategoryMessageKey(profile.category));
    const fallbackDescription = city
        ? t('descriptionLocal', { name: profile.name, category: categoryLabel, city })
        : t('descriptionOnline', { name: profile.name, category: categoryLabel });

    return buildProfileMetadata({
        baseUrl: env.NEXT_PUBLIC_SITE_URL,
        locale,
        slug,
        name: profile.name,
        categoryLabel,
        city,
        siteName: serviceNameFromCapitalLetter,
        description: profile.description,
        fallbackDescription,
        imagePath: toServiceImagePath(profile.image),
        coverImagePath: selectOgCoverPath(viewKind, profile.premiumContent),
    });
}

/**
 * Profil firmy: darmowy albo szablon premium (`selectProfileView`). Bez `<Suspense>` wokol tresci: istnienie slugu sprawdza
 * middleware (prawdziwe 404), a `notFound()` to siatka bezpieczenstwa na wypadek,
 * gdy lookup w middleware zawiodl (fail-open).
 */
export default async function ServiceProfilePage({ params }: PageProps): Promise<ReactElement> {
    const { locale: rawLocale, slug } = await params;
    const locale = toLocale(rawLocale);
    setRequestLocale(locale);

    const profile = await getCachedServiceProfile(slug, locale);
    if (!profile) notFound();

    const viewKind = resolveProfileView(profile);
    // Lokalizacje przychodza glowna pierwsza — to miasto glowne, jak `mainCity` w zapytaniu.
    const similarServices = shouldLoadSimilarServices(viewKind)
        ? await getSimilarServices(
              {
                  serviceId: profile.id,
                  category: profile.category,
                  city: profile.locations[0]?.city ?? null,
              },
              locale,
          )
        : [];
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
            <ProfileView view={view} viewKind={viewKind} />
        </>
    );
}
