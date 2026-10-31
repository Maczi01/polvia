import { defaultLocale, type Locale, locales } from '@/i18n/config';
import type { Coverage } from '@/lib/coverage';
import { buildServiceProfilePath } from '@/lib/service-profile-path';
import { WEEKDAY_KEYS } from '@/lib/weekdays';

/**
 * Metadane SEO profilu firmy `/firma/<slug>`: adresy kanoniczne i hreflang, opis meta
 * i JSON-LD. Czyste funkcje — `page.tsx` tylko podaje dane i tlumaczenia.
 */

/** Dlugosc opisu meta, ktora Google zwykle pokazuje bez obciecia. */
export const META_DESCRIPTION_MAX_LENGTH = 160;

const ELLIPSIS = '…';

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

export type ProfileTitleInput = {
    name: string;
    categoryLabel: string;
    /** `null` dla wpisu bez punktu obslugi — tytul jest wtedy bez miasta. */
    city: string | null;
    siteName: string;
};

/** `<nazwa> — <kategoria>, <miasto> | <serwis>`; bez miasta: `<nazwa> — <kategoria> | <serwis>`. */
export function buildProfileTitle({ name, categoryLabel, city, siteName }: ProfileTitleInput): string {
    const place = city?.trim() ? `, ${city.trim()}` : '';
    return `${name} — ${categoryLabel}${place} | ${siteName}`;
}

/**
 * Opis meta: biale znaki zwiniete do spacji, a dluzszy tekst obciety na granicy slowa
 * z wielokropkiem. Pojedyncze slowo dluzsze niz limit jest ciete twardo.
 */
export function truncateMetaDescription(
    text: string,
    maxLength: number = META_DESCRIPTION_MAX_LENGTH,
): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;

    const room = normalized.slice(0, maxLength - ELLIPSIS.length);
    const lastSpace = room.lastIndexOf(' ');
    const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room;
    return `${cut.replace(/[\s,.;:!?—–-]+$/, '')}${ELLIPSIS}`;
}

type OpeningHours = Readonly<Record<string, { open: string; close: string }>>;

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
};

type JsonLdValue = string | number | JsonLdObject | JsonLdValue[];
type JsonLdObject = { [key: string]: JsonLdValue };

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
 * JSON-LD profilu: `LocalBusiness` dla wpisu z punktem obslugi (`local`, `hybrid`),
 * `Organization` bez adresu, wspolrzednych i godzin dla wpisu `online`.
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
    };

    if (input.coverage === 'online' || !location) {
        return compact({ ...base, '@type': 'Organization' });
    }

    return compact({
        ...base,
        '@type': 'LocalBusiness',
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
