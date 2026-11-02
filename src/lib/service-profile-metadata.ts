import type { Metadata } from 'next';

import { defaultLocale, type Locale, locales } from '@/i18n/config';
import type { Coverage } from '@/lib/coverage';
import type { ServiceLanguage } from '@/lib/languages';
import { getLocalBusinessSchemaType } from '@/lib/schema-org-business-types';
import { buildServiceProfilePath } from '@/lib/service-profile-path';
import { buildProfileTitle, type ProfileTitleInput } from '@/lib/service-profile-title';
import { truncateAtWord } from '@/lib/truncate-at-word';
import { type OpeningHours, WEEKDAY_KEYS } from '@/lib/weekdays';

export {
    buildProfileTitle,
    PROFILE_TITLE_MAX_LENGTH,
    type ProfileTitleInput,
} from '@/lib/service-profile-title';

/**
 * Metadane SEO profilu firmy `/firma/<slug>`: adresy kanoniczne i hreflang, opis meta
 * i JSON-LD. Czyste funkcje — `page.tsx` tylko podaje dane i tlumaczenia.
 */

/** Dlugosc opisu meta, ktora Google zwykle pokazuje bez obciecia. */
export const META_DESCRIPTION_MAX_LENGTH = 160;

/** Kraj wszystkich wpisow katalogu (adresy z polskich wojewodztw). */
const ADDRESS_COUNTRY = 'PL';

/** Absolutny adres profilu w danym locale. */
export function buildProfileCanonicalUrl(baseUrl: string, locale: Locale, slug: string): string {
    return `${baseUrl}${buildServiceProfilePath(locale, slug)}`;
}

/** `alternates.languages`: wszystkie locale + `x-default` (wersja domyslna, bez prefiksu). */
export function buildProfileLanguageAlternates(
    baseUrl: string,
    slug: string,
): Record<string, string> {
    const alternates: Record<string, string> = {};
    for (const locale of locales) {
        alternates[locale] = buildProfileCanonicalUrl(baseUrl, locale, slug);
    }
    alternates['x-default'] = buildProfileCanonicalUrl(baseUrl, defaultLocale, slug);
    return alternates;
}

/**
 * Opis meta: biale znaki zwiniete do spacji, a dluzszy tekst obciety na granicy slowa
 * z wielokropkiem. Pojedyncze slowo dluzsze niz limit jest ciete twardo.
 */
export function truncateMetaDescription(
    text: string,
    maxLength: number = META_DESCRIPTION_MAX_LENGTH,
): string {
    return truncateAtWord(text, maxLength);
}

type FallbackDescriptionBaseKey = 'descriptionLocal' | 'descriptionOnline' | 'descriptionGeneric';

/**
 * Klucz opisu zastepczego w `ServiceProfile.meta`. Wariant `…Languages` ma dodatkowe zdanie
 * o jezykach obslugi (parametry `languages` i `languageCount`).
 */
export type FallbackDescriptionKey =
    | FallbackDescriptionBaseKey
    | `${FallbackDescriptionBaseKey}Languages`;

function selectFallbackDescriptionBaseKey(
    coverage: Coverage,
    city: string | null,
): FallbackDescriptionBaseKey {
    if (city?.trim()) return 'descriptionLocal';
    return coverage === 'local' ? 'descriptionGeneric' : 'descriptionOnline';
}

/**
 * Opis zastepczy zgodny z zasiegiem: z miastem `descriptionLocal`; bez miasta wpis
 * `online`/`hybrid` (obsluguje zdalnie) dostaje `descriptionOnline`, a `local` bez adresu —
 * neutralny `descriptionGeneric`, bo „obsluga online” bylaby nieprawda.
 * Firma z jezykami obslugi poza polskim (`selectDescribedLanguages`) dostaje wariant
 * `…Languages` tego samego klucza.
 */
export function selectFallbackDescriptionKey(
    coverage: Coverage,
    city: string | null,
    hasDescribedLanguages: boolean = false,
): FallbackDescriptionKey {
    const key = selectFallbackDescriptionBaseKey(coverage, city);
    return hasDescribedLanguages ? `${key}Languages` : key;
}

/** Absolutny adres sciezki z `public/` albo `null`, gdy sciezki nie ma. */
export function toAbsoluteUrl(baseUrl: string, path: string | null): string | null {
    return path ? `${baseUrl}${path}` : null;
}

/** Opis meta: opis firmy, a gdy jest pusty lub bialy — opis zastepczy z tlumaczen. */
export function pickMetaDescription(description: string | null, fallback: string): string {
    return truncateMetaDescription(description?.trim() ? description : fallback);
}

/** Metadane adresu bez aktywnego wpisu: strona nie trafia do indeksu. */
export const MISSING_PROFILE_METADATA: Metadata = { robots: { index: false, follow: false } };

export type ProfileMetadataInput = ProfileTitleInput & {
    baseUrl: string;
    locale: Locale;
    slug: string;
    /** Opis firmy w locale; pusty albo bialy oznacza „brak”. */
    description: string | null;
    /** Opis zastepczy (z tlumaczen), gdy firma nie ma wlasnego. */
    fallbackDescription: string;
    /** Sciezka logo (`/services/<plik>`) albo `null` — wtedy bez obrazka w Open Graph. */
    imagePath: string | null;
    /**
     * Sciezka coveru premium (`selectOgCoverPath`); niepusta tylko przy widoku premium
     * i wtedy zastepuje logo w Open Graph. `null` — obrazkiem zostaje logo.
     */
    coverImagePath: string | null;
};

/** `generateMetadata` profilu; `null` (brak aktywnego wpisu) daje `noindex`. */
export function buildProfileMetadata(input: ProfileMetadataInput | null): Metadata {
    if (!input) return MISSING_PROFILE_METADATA;

    const { baseUrl, locale, slug, name, siteName } = input;
    const title = buildProfileTitle(input);
    const description = pickMetaDescription(input.description, input.fallbackDescription);
    const url = buildProfileCanonicalUrl(baseUrl, locale, slug);
    const imageUrl = toAbsoluteUrl(baseUrl, input.coverImagePath ?? input.imagePath);

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
            siteName,
            images: imageUrl ? [{ url: imageUrl, alt: name }] : undefined,
        },
        robots: { index: true, follow: true },
    };
}

/** Lokalizacja potrzebna do JSON-LD — podzbior `ProfileLocation`. */
export type JsonLdLocation = {
    street: string | null;
    city: string | null;
    postcode: string | null;
    voivodeship: string | null;
    latitude: number | null;
    longitude: number | null;
    phoneNumber: string | null;
    email: string | null;
    openingHours: OpeningHours;
};

export type ProfileJsonLdInput = {
    name: string;
    description: string | null;
    /** Absolutny adres profilu. */
    url: string;
    /** Absolutny adres logo albo `null`. */
    imageUrl: string | null;
    coverage: Coverage;
    location: JsonLdLocation | null;
    /** Profile w mediach spolecznosciowych. */
    sameAs: string[];
    /** Klucz kategorii (`@/lib/categories`) — wyznacza podtyp `LocalBusiness`. */
    category: string;
    /** Jezyki obslugi; kody `languages.ts` sa juz kodami BCP 47 (`knowsLanguage`). */
    languages: readonly ServiceLanguage[];
};

type JsonLdValue = string | number | JsonLdObject | JsonLdValue[];
export type JsonLdObject = { [key: string]: JsonLdValue };

/** Pola bez wartosci (`null`, pusty tekst, pusta lista) nie trafiaja do JSON-LD. */
function compact(entries: Record<string, JsonLdValue | null | undefined>): JsonLdObject {
    const result: JsonLdObject = {};
    for (const [key, value] of Object.entries(entries)) {
        if (value === null || value === undefined || value === '') continue;
        if (Array.isArray(value) && value.length === 0) continue;
        result[key] = value;
    }
    return result;
}

function buildPostalAddress(location: JsonLdLocation): JsonLdObject | null {
    if (!location.street?.trim() && !location.city?.trim()) return null;
    return compact({
        '@type': 'PostalAddress',
        streetAddress: location.street,
        addressLocality: location.city,
        postalCode: location.postcode,
        addressRegion: location.voivodeship,
        addressCountry: ADDRESS_COUNTRY,
    });
}

function buildGeo(location: JsonLdLocation): JsonLdObject | null {
    if (location.latitude === null || location.longitude === null) return null;
    return { '@type': 'GeoCoordinates', latitude: location.latitude, longitude: location.longitude };
}

function toSchemaDay(weekday: string): string {
    return `https://schema.org/${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
}

function buildOpeningHoursSpecification(openingHours: OpeningHours): JsonLdObject[] {
    return WEEKDAY_KEYS.flatMap(weekday => {
        const period = openingHours[weekday];
        if (!period) return [];
        return [
            {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: toSchemaDay(weekday),
                opens: period.open,
                closes: period.close,
            },
        ];
    });
}

/**
 * JSON-LD profilu: typ wynika z zasiegu, nie z obecnosci lokalizacji. Wpis z punktem
 * obslugi (`local`, `hybrid`) dostaje podtyp `LocalBusiness` z kategorii
 * (`CATEGORY_SCHEMA_TYPES`) — bez lokalizacji w danych po prostu bez adresu, wspolrzednych
 * i godzin. `Organization` tylko dla wpisu `online`: podtypy `LocalBusiness` zakladaja
 * fizyczny adres, ktorego taki wpis nie ma.
 * Bez `priceRange`: ceny w cenniku premium to wolny tekst („od 250 zł/mies.”), wiec
 * przedzial bylby zgadywaniem.
 */
export function buildProfileJsonLd(input: ProfileJsonLdInput): JsonLdObject {
    const { location } = input;
    const base = {
        '@context': 'https://schema.org',
        name: input.name,
        description: input.description,
        url: input.url,
        image: input.imageUrl,
        telephone: location?.phoneNumber,
        email: location?.email,
        sameAs: input.sameAs,
        knowsLanguage: [...input.languages],
    };

    if (input.coverage === 'online') {
        return compact({ ...base, '@type': 'Organization' });
    }

    const type = getLocalBusinessSchemaType(input.category);
    if (!location) return compact({ ...base, '@type': type });

    return compact({
        ...base,
        '@type': type,
        address: buildPostalAddress(location),
        geo: buildGeo(location),
        openingHoursSpecification: buildOpeningHoursSpecification(location.openingHours),
    });
}

/**
 * Tresc `<script type="application/ld+json">`. `<` zamieniony na `<` (nadal
 * poprawny JSON), wiec `</script>` z opisu firmy nie zamknie znacznika.
 */
export function serializeJsonLd(data: JsonLdObject): string {
    return JSON.stringify(data).replace(/</g, '\\u003c');
}
