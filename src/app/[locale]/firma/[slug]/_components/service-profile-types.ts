import type { ComponentProps } from 'react';

import type { Link } from '@/i18n/navigation';
import type { Coverage } from '@/lib/coverage';
import type { ServiceLanguage } from '@/lib/languages';
import type { PremiumTemplate } from '@/lib/premium-templates';
import type { Socials } from '@/types';

/**
 * Kontrakt widoku profilu firmy. Komponenty profilu nie znaja bazy ani czterech
 * tlumaczen: teksty (opis, cennik, FAQ) sa juz rozwiazane dla biezacego locale,
 * a sciezki obrazkow sa gotowe do `next/image`.
 */

/** Href w formacie `Link` z `@/i18n/navigation` (typowane sciezki routingu). */
export type ProfileHref = ComponentProps<typeof Link>['href'];

export type OpeningPeriod = { open: string; close: string };

/** Klucze jak w kolumnie `opening_hours`: `monday` … `sunday` (`@/lib/weekdays`). */
export type OpeningHours = Readonly<Record<string, OpeningPeriod>>;

export type ProfileLocation = {
    id: string;
    city: string | null;
    street: string | null;
    postcode: string | null;
    /** Wartosc z bazy, np. `mazowieckie`; etykiete daje `VOIVODESHIP_TO_MESSAGE_KEY`. */
    voivodeship: string | null;
    latitude: number | null;
    longitude: number | null;
    phoneNumber: string | null;
    email: string | null;
    webpage: string | null;
    socials: Socials | null;
    whatsappNumber: string | null;
    openingHours: OpeningHours;
    isMain: boolean;
};

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

export type ProfileImage = { src: string; alt: string };

export type PriceListItem = { name: string; price: string; note?: string };

export type FaqItem = { question: string; answer: string };

export type PremiumContent = {
    template: PremiumTemplate;
    coverImage: ProfileImage | null;
    gallery: ProfileImage[];
    priceList: PriceListItem[];
    faq: FaqItem[];
};

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
    /** Glowna lokalizacja ma `isMain`; bez niej glowna jest pierwsza. */
    locations: ProfileLocation[];
    /** Link „Pokaz na mapie”; `null` dla wpisow bez punktu obslugi. */
    mapHref: ProfileHref | null;
    similarServices: SimilarService[];
    upgradeHref: ProfileHref;
    premium: PremiumContent | null;
};
