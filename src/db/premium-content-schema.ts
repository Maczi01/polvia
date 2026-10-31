import { z } from 'zod';

import { PREMIUM_GALLERY_MAX, PREMIUM_TEMPLATES } from '../lib/premium-templates';

/**
 * Tresc premium wpisu: blok `premium` w `data/services/<plik>.json` i ten sam ksztalt
 * w kolumnach `service_profiles` (jsonb). Jeden schemat na zapisie (`db:premium`, seed)
 * i na odczycie (`getServiceProfile`), bo jsonb nie ma wlasnej walidacji.
 *
 * Modul czysty (tylko zod): importuje go `service-input-schema.ts`, a ten trafia takze
 * do kodu aplikacji. Stale bierze z lekkiego `src/lib/premium-templates.ts`, ktory czyta klient.
 */

/** Reeksport z lekkiego modulu — klient importuje `@/lib/premium-templates` bez zoda. */
export {
    PREMIUM_GALLERY_MAX,
    PREMIUM_TEMPLATES,
    type PremiumTemplate,
} from '../lib/premium-templates';

const MAX_ALT_LENGTH = 200;
const MAX_PRICE_NAME_LENGTH = 120;
const MAX_PRICE_LENGTH = 60;
const MAX_PRICE_NOTE_LENGTH = 200;
const MAX_QUESTION_LENGTH = 200;
const MAX_ANSWER_LENGTH = 2000;
const MAX_IMAGE_FILE_LENGTH = 255;

/**
 * Sama nazwa pliku z `public/services/<slug-uslugi>/`: bez `/`, bez `..`, z rozszerzeniem
 * obrazka. Nazwa skleja sie w sciezke na dysku i w `src`, wiec format zamyka path traversal.
 */
export const PREMIUM_IMAGE_FILE_PATTERN = /^[\w-]+(?:\.[\w-]+)*\.(?:jpe?g|png|webp|avif)$/i;

const imageFileSchema = z
    .string()
    .max(MAX_IMAGE_FILE_LENGTH)
    .regex(
        PREMIUM_IMAGE_FILE_PATTERN,
        'Sama nazwa pliku z public/services/<slug>/ (jpg, png, webp, avif), bez sciezki',
    );

/**
 * Tekst w czterech jezykach tresci. Klucze jak w `translations` wpisu; brak ktoregokolwiek
 * odrzuca blok — strona w tym locale pokazalaby pusta pozycje (R13).
 */
function translatedText(maxLength: number) {
    const text = z
        .string()
        .trim()
        .min(1, 'Tekst jest wymagany w kazdym z czterech jezykow')
        .max(maxLength);

    return z.object({ pl: text, uk: text, en: text, ru: text }).strict();
}

const galleryItemSchema = z
    .object({
        file: imageFileSchema,
        alt: translatedText(MAX_ALT_LENGTH),
    })
    .strict();

const priceListItemSchema = z
    .object({
        name: translatedText(MAX_PRICE_NAME_LENGTH),
        /** Tekst, nie liczba: "od 150 zl", "wycena indywidualna". */
        price: translatedText(MAX_PRICE_LENGTH),
        note: translatedText(MAX_PRICE_NOTE_LENGTH).optional(),
    })
    .strict();

const faqItemSchema = z
    .object({
        q: translatedText(MAX_QUESTION_LENGTH),
        a: translatedText(MAX_ANSWER_LENGTH),
    })
    .strict();

export const premiumContentSchema = z
    .object({
        template: z.enum(PREMIUM_TEMPLATES),
        coverImage: imageFileSchema.nullable().default(null),
        gallery: z
            .array(galleryItemSchema)
            .max(PREMIUM_GALLERY_MAX, `Galeria: najwyzej ${PREMIUM_GALLERY_MAX} zdjec`)
            .default([]),
        priceList: z.array(priceListItemSchema).default([]),
        faq: z.array(faqItemSchema).default([]),
    })
    .strict();

export type PremiumContentData = z.infer<typeof premiumContentSchema>;
export type PremiumGalleryItem = z.infer<typeof galleryItemSchema>;
export type PremiumPriceListItem = z.infer<typeof priceListItemSchema>;
export type PremiumFaqItem = z.infer<typeof faqItemSchema>;
export type PremiumContentLocale = keyof PremiumGalleryItem['alt'];

/** Pliki obrazow tresci w kolejnosci: cover, potem galeria. */
export function premiumImageFiles(content: PremiumContentData): string[] {
    const gallery = content.gallery.map(item => item.file);

    return content.coverImage === null ? gallery : [content.coverImage, ...gallery];
}

/** Sciezka obrazka premium dla `next/image` (`public/services/<slug>/<plik>`). */
export function premiumImagePath(serviceSlug: string, file: string): string {
    return `/services/${serviceSlug}/${file}`;
}

/**
 * Tresc premium w jednym locale — ksztalt kontraktu widoku profilu (`PremiumContent`
 * w `service-profile-types.ts`). Zdefiniowany tutaj, bo warstwa danych nie importuje z `app/`.
 */
export type LocalizedPremiumContent = {
    template: PremiumContentData['template'];
    coverImage: { src: string; alt: string } | null;
    gallery: { src: string; alt: string }[];
    priceList: { name: string; price: string; note?: string }[];
    faq: { question: string; answer: string }[];
};

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
