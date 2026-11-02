import type { Locale } from '@/i18n/config';
import { toServiceLanguages } from '@/lib/languages';
import { buildServiceUrl } from '@/lib/map-url-builder';
import type { ProfileBreadcrumb } from '@/lib/service-profile-breadcrumbs';
import type { ServiceProfile } from '@/lib/service-profile-queries';
import type { SimilarServiceRow } from '@/lib/similar-services';

import type { ProfileViewKind } from './select-profile-view';
import type { ProfileHref, ServiceProfileView, SimilarService } from './service-profile-types';

/** Sciezka obrazka z `public/services/` albo `null` (komponent pokaze `/default.png`). */
export function toServiceImagePath(image: string | null): string | null {
    return image?.trim() ? `/services/${image.trimEnd()}` : null;
}

/**
 * Link „Pokaz na mapie” do pinu glownej lokalizacji. Wpis `online` i lokalizacja
 * bez wspolrzednych nie maja pinu, wiec nie maja tez linku.
 */
function toMapHref(profile: ServiceProfile, locale: Locale): ProfileHref | null {
    if (profile.coverage === 'online') return null;
    const main = profile.locations.find(location => location.isMainLocation) ?? profile.locations[0];
    if (!main || main.latitude === null || main.longitude === null) return null;

    const { query } = buildServiceUrl(main.slug, locale);
    return { pathname: '/map', query };
}

function toSimilarService(row: SimilarServiceRow): SimilarService {
    return {
        slug: row.slug,
        name: row.name,
        logo: toServiceImagePath(row.image),
        city: row.city,
        category: row.category,
        href: { pathname: '/firma/[slug]', params: { slug: row.slug } },
    };
}

/**
 * Wynik zapytan profilu -> kontrakt widoku. Tresc premium bierze z decyzji widoku
 * (`selectProfileView`), wiec widok free dostaje `premium: null`. Okruszki sklada strona
 * (`buildProfileBreadcrumbs`), bo potrzebuja przetlumaczonej kategorii.
 */
export function toProfileView(
    profile: ServiceProfile,
    similarServices: readonly SimilarServiceRow[],
    locale: Locale,
    viewKind: ProfileViewKind,
    breadcrumbs: readonly ProfileBreadcrumb[],
): ServiceProfileView {
    return {
        serviceId: profile.id,
        slug: profile.slug,
        name: profile.name,
        description: profile.description,
        logo: toServiceImagePath(profile.image),
        category: profile.category,
        coverage: profile.coverage,
        languages: toServiceLanguages(profile.languages),
        tags: profile.tags,
        verified: profile.verified,
        locations: profile.locations,
        mapHref: toMapHref(profile, locale),
        similarServices: similarServices.map(toSimilarService),
        premium: viewKind.kind === 'premium' ? viewKind.content : null,
        breadcrumbs: [...breadcrumbs],
    };
}
