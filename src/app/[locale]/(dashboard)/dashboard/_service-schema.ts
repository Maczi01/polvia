import { z } from 'zod';

import { categoryEnum, coverageEnum, statusEnum, voivodeshipEnum } from '@/db/schema';
import { SERVICE_LANGUAGES } from '@/lib/languages';

/**
 * Czysta warstwa walidacji formularza uslugi.
 *
 * Wydzielona z `_actions.ts`, bo tamten modul importuje `@/db` (klient postgres
 * tworzony przy ladowaniu moduluw `src/db/index.ts`), `sharp` i `node:fs/promises`
 * — czyli nie da sie go zaimportowac w tescie jednostkowym bez otwierania
 * poloczenia z baza. `@/db/schema` jest bezpieczny: definiuje tylko tabele i enumy.
 */

export const categoryValues = categoryEnum.enumValues;
export const coverageValues = coverageEnum.enumValues;
export const statusValues = statusEnum.enumValues;
export const voivodeshipValues = voivodeshipEnum.enumValues;

/**
 * `FormData.get()` zwraca `null` dla nieobecnego pola i `''` dla pustego inputu.
 * `z.coerce.number()` zamienia OBA na `0` — czyli wpis bez wspolrzednych dostalby
 * pin na (0, 0), w Zatoce Gwinejskiej, i przeszedlby walidacje bez sladu.
 * Dlatego puste wejscie normalizujemy do `null` PRZED coercja.
 */
const emptyToNull = (value: unknown): unknown =>
    value === '' || value === null || value === undefined ? null : value;

const optionalCoordinate = (min: number, max: number) =>
    z.preprocess(emptyToNull, z.coerce.number().min(min).max(max).nullable());

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''));

export const serviceSchema = z
    .object({
        name: z.string().min(1, 'Name is required').max(255),
        category: z.enum(categoryValues),
        coverage: z.enum(coverageValues).default('local'),
        status: z.enum(statusValues).default('active'),
        webpage: optionalText(255),
        nip: optionalText(10),
        languages: z.array(z.enum(SERVICE_LANGUAGES)).default(['pl']),
        whatsappNumber: optionalText(20),
        socials: z
            .object({
                instagram: z.string().optional().or(z.literal('')),
                telegram: z.string().optional().or(z.literal('')),
                tiktok: z.string().optional().or(z.literal('')),
                facebook: z.string().optional().or(z.literal('')),
                youtube: z.string().optional().or(z.literal('')),
                viber: z.string().optional().or(z.literal('')),
                whatsapp: z.string().optional().or(z.literal('')),
                x: z.string().optional().or(z.literal('')),
            })
            .optional(),
        // Location
        city: optionalText(255),
        street: optionalText(255),
        voivodeship: z
            .enum(voivodeshipValues)
            .optional()
            .or(z.literal('')),
        postcode: optionalText(20),
        latitude: optionalCoordinate(-90, 90),
        longitude: optionalCoordinate(-180, 180),
        phoneNumber: optionalText(50),
        email: z.string().email().max(255).optional().or(z.literal('')),
        // Translations
        namePl: optionalText(255),
        nameEn: optionalText(255),
        nameUk: optionalText(255),
        nameRu: optionalText(255),
        descriptionPl: z.string().optional().or(z.literal('')),
        descriptionEn: z.string().optional().or(z.literal('')),
        descriptionUk: z.string().optional().or(z.literal('')),
        descriptionRu: z.string().optional().or(z.literal('')),
        // Tags
        tags: z.array(z.string()).default([]),
    })
    .superRefine((data, ctx) => {
        // Zasieg `online` i `hybrid` obsluguje cala Polske — bez miasta wpis nie
        // niesie zadnego sygnalu geograficznego (jezyk obslugi, zaufanie).
        if (data.coverage !== 'local' && !data.city?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['city'],
                message: 'City is required for online and hybrid coverage',
            });
        }

        // Wpis, ktory mozna odwiedzic (`local`, `hybrid`), dostaje pin na mapie —
        // bez wspolrzednych jest bezuzyteczny. Tylko `online` moze byc bez nich.
        if (data.coverage !== 'online') {
            if (data.latitude === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['latitude'],
                    message: 'Latitude is required unless coverage is online',
                });
            }
            if (data.longitude === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['longitude'],
                    message: 'Longitude is required unless coverage is online',
                });
            }
        }
    });

export type ServiceFormData = z.infer<typeof serviceSchema>;

/**
 * `FormData.getAll()` zwraca `FormDataEntryValue[]` (string | File). Plik w polu tekstowym
 * pomijamy zamiast rzutowac — poprawnosc samych kodow sprawdza dopiero Zod (`z.enum`).
 */
const isText = (value: FormDataEntryValue): value is string => typeof value === 'string';

/**
 * Pole tekstowe bez rzutowania `as string`: nieobecne pole zostaje `null`, a plik
 * podstawiony pod pole tekstowe tez daje `null` — w obu przypadkach odrzuca je Zod.
 */
const text = (formData: FormData, key: string): string | null => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : null;
};

export function parseRawServiceData(formData: FormData) {
    const raw = {
        name: text(formData, 'name'),
        category: text(formData, 'category'),
        coverage: text(formData, 'coverage') || 'local',
        status: text(formData, 'status') || 'active',
        webpage: text(formData, 'webpage'),
        nip: text(formData, 'nip'),
        languages: formData.getAll('languages').filter(isText),
        whatsappNumber: text(formData, 'whatsappNumber'),
        socials: {
            instagram: text(formData, 'socials.instagram'),
            telegram: text(formData, 'socials.telegram'),
            tiktok: text(formData, 'socials.tiktok'),
            facebook: text(formData, 'socials.facebook'),
            youtube: text(formData, 'socials.youtube'),
            viber: text(formData, 'socials.viber'),
            whatsapp: text(formData, 'socials.whatsapp'),
            x: text(formData, 'socials.x'),
        },
        city: text(formData, 'city'),
        street: text(formData, 'street'),
        voivodeship: text(formData, 'voivodeship'),
        postcode: text(formData, 'postcode'),
        latitude: text(formData, 'latitude'),
        longitude: text(formData, 'longitude'),
        phoneNumber: text(formData, 'phoneNumber'),
        email: text(formData, 'email'),
        namePl: text(formData, 'namePl'),
        nameEn: text(formData, 'nameEn'),
        nameUk: text(formData, 'nameUk'),
        nameRu: text(formData, 'nameRu'),
        descriptionPl: text(formData, 'descriptionPl'),
        descriptionEn: text(formData, 'descriptionEn'),
        descriptionUk: text(formData, 'descriptionUk'),
        descriptionRu: text(formData, 'descriptionRu'),
        tags: formData.getAll('tags').filter(isText),
    };
    if (raw.languages.length === 0) {
        raw.languages = ['pl'];
    }
    return raw;
}
