import { z } from 'zod';

import { type Locale, locales } from '../i18n/config';
import {
    PREMIUM_FAQ_MAX,
    PREMIUM_GALLERY_MAX,
    PREMIUM_PRICE_LIST_MAX,
    PREMIUM_TEMPLATES,
} from '../lib/premium-templates';

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
    PREMIUM_FAQ_MAX,
    PREMIUM_GALLERY_MAX,
    PREMIUM_PRICE_LIST_MAX,
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
 * Tekst w kazdym locale tresci (`locales` z `@/i18n/config`). Brak ktoregokolwiek odrzuca
 * blok — strona w tym locale pokazalaby pusta pozycje (R13). Literal zamiast
 * `Object.fromEntries(locales…)`, zeby typ pol nie wymagal `as`; `satisfies` wymusza, ze
 * klucze to dokladnie `Locale` — nowe locale w configu nie skompiluje sie bez wpisu tutaj.
 */
function translatedText(maxLength: number) {
    const text = z
        .string()
        .trim()
        .min(1, 'Tekst jest wymagany w kazdym jezyku tresci')
        .max(maxLength);
    const shape = { pl: text, uk: text, en: text, ru: text } satisfies Record<Locale, typeof text>;

    return z.object(shape).strict();
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

/**
 * Druga i kolejne wystapienia tej samej wartosci jako blad na sciezce duplikatu. Duplikat
 * diff zlewa w „Bez zmian”, a w widoku daje powtorzony klucz Reacta.
 */
function reportDuplicates(
    context: z.RefinementCtx,
    values: readonly string[],
    pathAt: (index: number) => (string | number)[],
): void {
    const seen = new Set<string>();
    for (const [index, value] of values.entries()) {
        if (seen.has(value)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Powtorzona pozycja — kazda musi byc unikalna',
                path: pathAt(index),
            });
        }
        seen.add(value);
    }
}

export const premiumContentSchema = z
    .object({
        template: z.enum(PREMIUM_TEMPLATES),
        coverImage: imageFileSchema.nullable().default(null),
        gallery: z
            .array(galleryItemSchema)
            .max(PREMIUM_GALLERY_MAX, `Galeria: najwyzej ${PREMIUM_GALLERY_MAX} zdjec`)
            .default([]),
        priceList: z
            .array(priceListItemSchema)
            .max(PREMIUM_PRICE_LIST_MAX, `Cennik: najwyzej ${PREMIUM_PRICE_LIST_MAX} pozycji`)
            .default([]),
        faq: z
            .array(faqItemSchema)
            .max(PREMIUM_FAQ_MAX, `FAQ: najwyzej ${PREMIUM_FAQ_MAX} pytan`)
            .default([]),
    })
    .strict()
    .superRefine((content, context) => {
        reportDuplicates(
            context,
            content.gallery.map(item => item.file),
            index => ['gallery', index, 'file'],
        );
        for (const locale of locales) {
            reportDuplicates(
                context,
                content.priceList.map(item => item.name[locale]),
                index => ['priceList', index, 'name', locale],
            );
            reportDuplicates(
                context,
                content.faq.map(item => item.q[locale]),
                index => ['faq', index, 'q', locale],
            );
        }
    });

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
