import type { ComponentProps } from 'react';

import type { Link } from '@/i18n/navigation';
import type { Coverage } from '@/lib/coverage';
import type { ServiceLanguage } from '@/lib/languages';
import type { LocalizedPremiumContent } from '@/lib/service-profile-premium';
import type { ServiceProfileLocation } from '@/lib/service-profile-queries';

/**
 * Kontrakt widoku profilu firmy. Komponenty profilu nie znaja bazy ani czterech
 * tlumaczen: teksty (opis, cennik, FAQ) sa juz rozwiazane dla biezacego locale,
 * a sciezki obrazkow sa gotowe do `next/image`.
 */

/** Href w formacie `Link` z `@/i18n/navigation` (typowane sciezki routingu). */
export type ProfileHref = ComponentProps<typeof Link>['href'];

/**
 * Lokalizacja profilu w ksztalcie z zapytania (nazwy jak w bazie, np. `isMainLocation`).
 * Bez `slug`: widok nie linkuje lokalizacji, link do mapy sklada `toProfileView`.
 */
export type ProfileLocation = Omit<ServiceProfileLocation, 'slug'>;

export type SimilarService = {
    slug: string;
    name: string;
    /** Sciezka obrazka (`/services/<plik>`) albo `null` — wtedy `/default.png`. */
    logo: string | null;
    city: string | null;
    /** Klucz kategorii (`@/lib/categories`). */
    category: string;
    href: ProfileHref;
};

/**
 * Tresc premium w jednym locale. Jedno zrodlo ksztaltu: projekcja w `@/lib/service-profile-premium`
 * (tylko `import type` — zod z tamtego modulu nie trafia do bundla klienta).
 */
export type PremiumContent = LocalizedPremiumContent;

export type { FaqItem, PriceListItem, ProfileImage } from '@/lib/service-profile-premium';

export type ServiceProfileView = {
    slug: string;
    name: string;
    description: string | null;
    /** Sciezka obrazka (`/services/<plik>`) albo `null` — wtedy `/default.png`. */
    logo: string | null;
    /** Klucz kategorii (`@/lib/categories`). */
    category: string;
    coverage: Coverage;
    languages: ServiceLanguage[];
    tags: string[];
    verified: boolean;
    /** Glowna lokalizacja ma `isMainLocation`; bez niej glowna jest pierwsza. */
    locations: ProfileLocation[];
    /** Link „Pokaz na mapie”; `null` dla wpisow bez punktu obslugi. */
    mapHref: ProfileHref | null;
    similarServices: SimilarService[];
    upgradeHref: ProfileHref;
    premium: PremiumContent | null;
};

/** Profil z trescia premium — jedyne wejscie szablonow premium (strona zaweza `view.premium`). */
export type PremiumProfileView = ServiceProfileView & { premium: PremiumContent };
