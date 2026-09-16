import slugify from 'slugify';
import { z } from 'zod';

import { categoryEnum, coverageEnum, statusEnum, voivodeshipEnum } from './schema';

/**
 * Czysta warstwa walidacji opisu wpisu katalogowego (plik JSON z `data/services/`).
 *
 * Wydzielona z `add-service.ts`, bo tamten modul importuje `./index` — klient
 * postgresa tworzony przy ladowaniu modulu, czyli nie da sie go zaimportowac
 * w tescie bez otwierania polaczenia z baza. `./schema` jest bezpieczny:
 * definiuje tylko tabele i enumy.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAYS = new Set([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]);

const dayHoursSchema = z
    .object({
        open: z.string().regex(TIME_PATTERN, 'Godzina w formacie HH:MM'),
        close: z.string().regex(TIME_PATTERN, 'Godzina w formacie HH:MM'),
    })
    .strict();

/**
 * `z.record` zamiast obiektu z siedmioma opcjonalnymi kluczami, bo kolumna
 * `opening_hours` ma typ `Record<string, { open, close }>` — obiekt z polami
 * opcjonalnymi nie jest do niego przypisywalny pod `strict`. Dzien nieczynny
 * po prostu pomijamy; `refine` pilnuje, zeby literowka ("monady") nie wjechala
 * do bazy jako nowy, niewidoczny dla UI dzien tygodnia.
 */
const openingHoursSchema = z
    .record(z.string(), dayHoursSchema)
    .refine(hours => Object.keys(hours).every(day => WEEKDAYS.has(day)), {
        message: 'Klucze godzin otwarcia to monday...sunday; dzien nieczynny pomin',
    });

const socialsSchema = z
    .object({
        instagram: z.string().url().optional(),
        telegram: z.string().url().optional(),
        tiktok: z.string().url().optional(),
        facebook: z.string().url().optional(),
        linkedin: z.string().url().optional(),
        youtube: z.string().url().optional(),
        viber: z.string().url().optional(),
        whatsapp: z.string().url().optional(),
        tripadvisor: z.string().url().optional(),
        /** Dawniej Twitter. Klucz `x`, bo taka jest dzis nazwa serwisu i domena. */
        x: z.string().url().optional(),
    })
    .strict();

/**
 * `.strict()` wszedzie, bo wejsciem jest recznie pisany JSON: `"lat"` zamiast
 * `"latitude"` przy przepuszczajacym schemacie zniknieloby po cichu i wpis
 * wyladowalby na mapie bez pinu albo w ogole poza nia.
 */
const locationInputSchema = z
    .object({
        city: z.string().min(1).max(255),
        street: z.string().max(255).nullish(),
        voivodeship: z.enum(voivodeshipEnum.enumValues).nullish(),
        postcode: z.string().max(20).nullish(),
        latitude: z.number().min(-90).max(90).nullish(),
        longitude: z.number().min(-180).max(180).nullish(),
        openingHours: openingHoursSchema.default({}),
        phoneNumber: z.string().max(50).nullish(),
        email: z.string().email().max(255).nullish(),
        webpage: z.string().url().max(255).nullish(),
        nip: z
            .string()
            .regex(/^\d{10}$/, 'NIP to 10 cyfr bez mysnikow')
            .nullish(),
        socials: socialsSchema.nullish(),
        whatsappNumber: z.string().max(20).nullish(),
        isMainLocation: z.boolean().default(false),
    })
    .strict();

const translationSchema = z
    .object({
        name: z.string().max(255).optional(),
        description: z.string().min(1, 'Opis jest wymagany w kazdym z czterech jezykow'),
    })
    .strict();

const tagInputSchema = z
    .object({
        pl: z.string().min(1),
        uk: z.string().min(1),
        en: z.string().min(1),
        ru: z.string().min(1),
    })
    .strict();

export type TagInput = z.infer<typeof tagInputSchema>;
export type LocationInput = z.infer<typeof locationInputSchema>;

export const serviceInputSchema = z
    .object({
        name: z.string().min(1).max(255),
        /** Baza slugu lokalizacji. Domyslnie wyliczana z `name` przez `buildServiceSlug`. */
        slug: z
            .string()
            .regex(/^[a-z0-9-]+$/, 'Slug: male litery, cyfry i mysniki')
            .optional(),
        category: z.enum(categoryEnum.enumValues),
        coverage: z.enum(coverageEnum.enumValues).default('local'),
        status: z.enum(statusEnum.enumValues).default('active'),
        verified: z.boolean().default(false),
        /** Sama nazwa pliku z `public/services/`, nie sciezka. */
        image: z.string().max(255).nullish(),
        languages: z.array(z.string().max(5)).min(1).default(['pl']),
        translations: z
            .object({
                pl: translationSchema,
                uk: translationSchema,
                en: translationSchema,
                ru: translationSchema,
            })
            .strict(),
        tags: z.array(tagInputSchema).default([]),
        locations: z
            .array(locationInputSchema)
            .min(1, 'Wpis potrzebuje co najmniej jednej lokalizacji'),
    })
    .strict()
    .superRefine((input, ctx) => {
        // Wpis odwiedzalny (`local`, `hybrid`) dostaje pin na mapie — bez
        // wspolrzednych jest bezuzyteczny. Tylko `online` moze byc bez nich.
        if (input.coverage !== 'online') {
            for (const [index, location] of input.locations.entries()) {
                for (const axis of ['latitude', 'longitude'] as const) {
                    if (location[axis] === null || location[axis] === undefined) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ['locations', index, axis],
                            message: `Pole ${axis} jest wymagane dla coverage "${input.coverage}"`,
                        });
                    }
                }
            }
        }

        // `online` to brak punktu obslugi. Kilka lokalizacji oznacza, ze wpis
        // faktycznie jest `hybrid` albo ze zasieg zostal zle sklasyfikowany.
        if (input.coverage === 'online' && input.locations.length > 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['locations'],
                message: 'Zasieg "online" dopuszcza jedna lokalizacje — dla kilku uzyj "hybrid"',
            });
        }

        const mainCount = input.locations.filter(location => location.isMainLocation).length;
        if (mainCount > 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['locations'],
                message: `Tylko jedna lokalizacja moze miec isMainLocation: true (jest ${mainCount})`,
            });
        }
    })
    .transform(input => ({
        ...input,
        slug: input.slug ?? buildServiceSlug(input.name),
        locations: withSingleMainLocation(input.locations),
    }));

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export function buildServiceSlug(name: string): string {
    return slugify(name, { lower: true, strict: true });
}

/**
 * Slug lokalizacji: `<slug-uslugi>-<slug-miasta>`, z numerem na koncu gdy w tym
 * samym miescie jest wiecej niz jeden punkt. Konwencja pochodzi z `seed.ts` —
 * to ona wyznacza dzialajace URL-e, wiec nowe wpisy musza ja powtarzac.
 */
export function buildLocationSlugs(serviceSlug: string, cities: string[]): string[] {
    const totals = new Map<string, number>();
    for (const city of cities) {
        const citySlug = slugify(city, { lower: true, strict: true });
        totals.set(citySlug, (totals.get(citySlug) ?? 0) + 1);
    }

    const seen = new Map<string, number>();

    return cities.map(city => {
        const citySlug = slugify(city, { lower: true, strict: true });
        const index = (seen.get(citySlug) ?? 0) + 1;
        seen.set(citySlug, index);

        return (totals.get(citySlug) ?? 0) > 1
            ? `${serviceSlug}-${citySlug}-${index}`
            : `${serviceSlug}-${citySlug}`;
    });
}

/** Brak wskazanej lokalizacji glownej: pierwsza z listy zostaje glowna. */
function withSingleMainLocation(locations: LocationInput[]): LocationInput[] {
    if (locations.some(location => location.isMainLocation)) return locations;

    return locations.map((location, index) => ({ ...location, isMainLocation: index === 0 }));
}
