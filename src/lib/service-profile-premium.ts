import {
    type PremiumContentData,
    type PremiumContentLocale,
    premiumContentSchema,
} from '@/db/premium-content-schema';
import { toLocale } from '@/i18n/config';

/**
 * Projekcja tresci premium na widok profilu: wybor locale, sciezki zdjec pod `next/image`.
 * Schemat (zapis i odczyt jsonb) zostaje w `src/db/premium-content-schema.ts`.
 *
 * `service-profile-types.ts` importuje stad wylacznie typy (`import type`), wiec zod
 * importowany tu jako wartosc nie trafia do bundla klienta.
 */

export type ProfileImage = { src: string; alt: string };

export type PriceListItem = { name: string; price: string; note?: string };

export type FaqItem = { question: string; answer: string };

/** Tresc premium w jednym locale — kontrakt szablonow premium (`PremiumContent`). */
export type LocalizedPremiumContent = {
    template: PremiumContentData['template'];
    coverImage: ProfileImage | null;
    gallery: ProfileImage[];
    priceList: PriceListItem[];
    faq: FaqItem[];
};

/** Sciezka obrazka premium dla `next/image` (`public/services/<slug>/<plik>`). */
export function premiumImagePath(serviceSlug: string, file: string): string {
    return `/services/${serviceSlug}/${file}`;
}

type LocalizeOptions = {
    serviceSlug: string;
    locale: PremiumContentLocale;
    /** Alt coveru: nazwa firmy w locale (cover nie ma wlasnego opisu w JSON). */
    coverAlt: string;
};

export function localizePremiumContent(
    content: PremiumContentData,
    { serviceSlug, locale, coverAlt }: LocalizeOptions,
): LocalizedPremiumContent {
    return {
        template: content.template,
        coverImage:
            content.coverImage === null
                ? null
                : { src: premiumImagePath(serviceSlug, content.coverImage), alt: coverAlt },
        gallery: content.gallery.map(item => ({
            src: premiumImagePath(serviceSlug, item.file),
            alt: item.alt[locale],
        })),
        priceList: content.priceList.map(item => ({
            name: item.name[locale],
            price: item.price[locale],
            ...(item.note === undefined ? {} : { note: item.note[locale] }),
        })),
        faq: content.faq.map(item => ({ question: item.q[locale], answer: item.a[locale] })),
    };
}

type PremiumContentSource = { serviceId: string; slug: string; locale: string; name: string };

/**
 * Jsonb z `service_profiles` -> tresc dla locale. Walidowany przy odczycie, bo baza nie
 * pilnuje ksztaltu: uszkodzona tresc daje profil bez premium, a nie wywalona strone.
 * `stored` to obiekt kolumn z left joina — `null`, gdy wiersza `service_profiles` brak.
 */
export function toPremiumContent(
    stored: object | null,
    { serviceId, slug, locale, name }: PremiumContentSource,
): LocalizedPremiumContent | null {
    if (stored === null) return null;

    const parsed = premiumContentSchema.safeParse(stored);
    if (!parsed.success) {
        // Same sciezki pol, bez wartosci. Brak loggera w repo: log Vercela to jedyny slad.
        // eslint-disable-next-line no-console
        console.error('service profile premium content invalid', {
            serviceId,
            issues: parsed.error.issues.map(issue => issue.path.join('.')),
        });
        return null;
    }

    return localizePremiumContent(parsed.data, {
        serviceSlug: slug,
        locale: toLocale(locale),
        coverAlt: name,
    });
}
