import { z } from 'zod';

import { categoryEnum, coverageEnum, statusEnum, voivodeshipEnum } from '@/db/schema';

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
        category: z.enum(categoryValues as [string, ...string[]]),
        coverage: z.enum(coverageValues as [string, ...string[]]).default('local'),
        status: z.enum(statusValues as [string, ...string[]]).default('active'),
        webpage: optionalText(255),
        nip: optionalText(10),
        languages: z.array(z.string()).default(['pl']),
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
            })
            .optional(),
        // Location
        city: optionalText(255),
        street: optionalText(255),
        voivodeship: z
            .enum(voivodeshipValues as [string, ...string[]])
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

export function parseRawServiceData(formData: FormData) {
    const raw = {
        name: formData.get('name') as string,
        category: formData.get('category') as string,
        coverage: (formData.get('coverage') as string) || 'local',
        status: (formData.get('status') as string) || 'active',
        webpage: formData.get('webpage') as string,
        nip: formData.get('nip') as string,
        languages: formData.getAll('languages') as string[],
        whatsappNumber: formData.get('whatsappNumber') as string,
        socials: {
            instagram: formData.get('socials.instagram') as string,
            telegram: formData.get('socials.telegram') as string,
            tiktok: formData.get('socials.tiktok') as string,
            facebook: formData.get('socials.facebook') as string,
            youtube: formData.get('socials.youtube') as string,
            viber: formData.get('socials.viber') as string,
            whatsapp: formData.get('socials.whatsapp') as string,
        },
        city: formData.get('city') as string,
        street: formData.get('street') as string,
        voivodeship: formData.get('voivodeship') as string,
        postcode: formData.get('postcode') as string,
        latitude: formData.get('latitude') as string,
        longitude: formData.get('longitude') as string,
        phoneNumber: formData.get('phoneNumber') as string,
        email: formData.get('email') as string,
        namePl: formData.get('namePl') as string,
        nameEn: formData.get('nameEn') as string,
        nameUk: formData.get('nameUk') as string,
        nameRu: formData.get('nameRu') as string,
        descriptionPl: formData.get('descriptionPl') as string,
        descriptionEn: formData.get('descriptionEn') as string,
        descriptionUk: formData.get('descriptionUk') as string,
        descriptionRu: formData.get('descriptionRu') as string,
        tags: formData.getAll('tags') as string[],
    };
    if (raw.languages.length === 0) {
        raw.languages = ['pl'];
    }
    return raw;
}
