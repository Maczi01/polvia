import { z } from 'zod';

import { TIME_PATTERN, WEEKDAY_KEYS } from '@/db/service-input-schema';
import { LANGUAGE_CODES, type LanguageCode } from '@/lib/add-business/draft-schema';
import type { OpeningHours } from '@/lib/add-business/jsonld-facts';

/**
 * Pola, ktore wlasciciel moze poprawic przed wysylka (R9: kategoria, zasieg, tagi i opisy
 * nie sa tu obecne — pochodza wylacznie ze szkicu w Redis).
 *
 * Formularz jest wstepnie wypelniony wartosciami szkicu, wiec wynik to KOMPLETNY stan pol
 * po edycji, a nie lista roznic: pole wyczyszczone przez wlasciciela przychodzi jako `null`.
 *
 * Granica `FormData` (docs/solutions/runtime-errors/2026-08-22-zod-coerce-number-puste-formdata.md):
 * `get()` zwraca `null` dla pola nieobecnego i `''` dla pustego — oba normalizujemy do `null`
 * PRZED walidacja, a wymagalnosc wyrazamy w `.superRefine()`.
 *
 * Komunikaty bledow to klucze tlumaczen z namespace `addBusiness` (dodawany w U9).
 */

export const OWNER_EDIT_ERRORS = {
    required: 'addBusiness.errors.required',
    invalidEmail: 'addBusiness.errors.invalidEmail',
    invalidUrl: 'addBusiness.errors.invalidUrl',
    invalidTime: 'addBusiness.errors.invalidTime',
    incompleteHours: 'addBusiness.errors.incompleteHours',
    invalidLanguage: 'addBusiness.errors.invalidLanguage',
    languagesRequired: 'addBusiness.errors.languagesRequired',
    tooLong: 'addBusiness.errors.tooLong',
    invalidValue: 'addBusiness.errors.invalidValue',
} as const;

export type OwnerEditErrorKey = (typeof OWNER_EDIT_ERRORS)[keyof typeof OWNER_EDIT_ERRORS];

export const NOTES_MAX_LENGTH = 2000;

const emptyToNull = (value: unknown): unknown => {
    const normalized = typeof value === 'string' ? value.trim() : value;
    return normalized === '' || normalized === null || normalized === undefined ? null : normalized;
};

/** `File` w polu tekstowym to podrobiony request — konczy sie bledem pola, nie wyjatkiem. */
const text = (): z.ZodString => z.string({ invalid_type_error: OWNER_EDIT_ERRORS.invalidValue });

export const optionalText = (max: number) =>
    z.preprocess(emptyToNull, text().max(max, OWNER_EDIT_ERRORS.tooLong).nullable());

export const optionalEmail = z.preprocess(
    emptyToNull,
    text().max(255, OWNER_EDIT_ERRORS.tooLong).email(OWNER_EDIT_ERRORS.invalidEmail).nullable(),
);

function isHttpUrl(value: string): boolean {
    if (!URL.canParse(value)) return false;
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
}

export const optionalWebpage = z.preprocess(
    emptyToNull,
    text()
        .max(255, OWNER_EDIT_ERRORS.tooLong)
        .refine(isHttpUrl, OWNER_EDIT_ERRORS.invalidUrl)
        .nullable(),
);

const optionalTime = z.preprocess(
    emptyToNull,
    text().regex(TIME_PATTERN, OWNER_EDIT_ERRORS.invalidTime).nullable(),
);

const dayPairSchema = z.object({ open: optionalTime, close: optionalTime });

const hoursSchema = z.object({
    monday: dayPairSchema,
    tuesday: dayPairSchema,
    wednesday: dayPairSchema,
    thursday: dayPairSchema,
    friday: dayPairSchema,
    saturday: dayPairSchema,
    sunday: dayPairSchema,
});

export interface OwnerEdits {
    name: string;
    street: string | null;
    postcode: string | null;
    city: string;
    phoneNumber: string | null;
    email: string | null;
    webpage: string | null;
    /** Ksztalt `serviceInputSchema`; `null` gdy wlasciciel nie podal zadnego dnia. */
    openingHours: OpeningHours | null;
    languages: LanguageCode[];
    submitterEmail: string;
    notes: string | null;
}

type HoursInput = z.infer<typeof hoursSchema>;

function toOpeningHours(hours: HoursInput): OpeningHours | null {
    const result: OpeningHours = {};
    for (const day of WEEKDAY_KEYS) {
        const { open, close } = hours[day];
        if (open !== null && close !== null) result[day] = { open, close };
    }
    return Object.keys(result).length > 0 ? result : null;
}

const REQUIRED_FIELDS = ['name', 'city', 'submitterEmail'] as const;

type RequiredFieldsInput = Record<(typeof REQUIRED_FIELDS)[number], string | null>;

function addRequiredIssues(input: RequiredFieldsInput, ctx: z.RefinementCtx): void {
    for (const field of REQUIRED_FIELDS) {
        if (input[field] !== null) continue;
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: OWNER_EDIT_ERRORS.required,
        });
    }
}

const ownerEditsSchema = z
    .object({
        name: optionalText(255),
        street: optionalText(255),
        postcode: optionalText(20),
        city: optionalText(255),
        phoneNumber: optionalText(50),
        email: optionalEmail,
        webpage: optionalWebpage,
        hours: hoursSchema,
        languages: z.array(
            z.enum(LANGUAGE_CODES, {
                errorMap: () => ({ message: OWNER_EDIT_ERRORS.invalidLanguage }),
            }),
        ),
        submitterEmail: optionalEmail,
        notes: optionalText(NOTES_MAX_LENGTH),
    })
    .superRefine((input, ctx) => {
        addRequiredIssues(input, ctx);

        if (input.languages.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['languages'],
                message: OWNER_EDIT_ERRORS.languagesRequired,
            });
        }

        // Pusta para = dzien nieczynny. Polowa pary to niedokonczona edycja, nie "zamkniete".
        for (const day of WEEKDAY_KEYS) {
            const { open, close } = input.hours[day];
            if ((open === null) === (close === null)) continue;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['hours', day, open === null ? 'open' : 'close'],
                message: OWNER_EDIT_ERRORS.incompleteHours,
            });
        }
    })
    // Zod pomija transform, gdy `superRefine` zglosil blad, wiec ponizszy warunek nie
    // odpali w praktyce — sluzy zawezeniu `string | null` do `string` bez `!` i `as`.
    .transform((input, ctx): OwnerEdits => {
        const { name, city, submitterEmail, hours, languages, ...rest } = input;
        if (name === null || city === null || submitterEmail === null) {
            addRequiredIssues(input, ctx);
            return z.NEVER;
        }

        return {
            ...rest,
            name,
            city,
            submitterEmail,
            languages: [...new Set(languages)],
            openingHours: toOpeningHours(hours),
        };
    });

/** Klucz = nazwa pola formularza (`hours.monday.open`), wartosc = klucz tlumaczenia. */
export type OwnerEditsFieldErrors = Record<string, OwnerEditErrorKey>;

export type OwnerEditsResult =
    | { ok: true; data: OwnerEdits }
    | { ok: false; fieldErrors: OwnerEditsFieldErrors };

const ERROR_KEYS = new Set<string>(Object.values(OWNER_EDIT_ERRORS));

function isErrorKey(message: string): message is OwnerEditErrorKey {
    return ERROR_KEYS.has(message);
}

function readRawFields(formData: FormData): Record<string, unknown> {
    const field = (name: string) => formData.get(name);

    return {
        name: field('name'),
        street: field('street'),
        postcode: field('postcode'),
        city: field('city'),
        phoneNumber: field('phoneNumber'),
        email: field('email'),
        webpage: field('webpage'),
        hours: Object.fromEntries(
            WEEKDAY_KEYS.map(day => [
                day,
                { open: field(`hours.${day}.open`), close: field(`hours.${day}.close`) },
            ]),
        ),
        languages: formData.getAll('languages'),
        submitterEmail: field('submitterEmail'),
        notes: field('notes'),
    };
}

export function parseOwnerEdits(formData: FormData): OwnerEditsResult {
    const parsed = ownerEditsSchema.safeParse(readRawFields(formData));

    if (!parsed.success) {
        const fieldErrors: OwnerEditsFieldErrors = {};
        for (const issue of parsed.error.issues) {
            // `languages.2` -> `languages`: blad dotyczy grupy checkboxow, nie pozycji.
            const key = issue.path.filter(segment => typeof segment === 'string').join('.');
            if (fieldErrors[key] !== undefined) continue;
            fieldErrors[key] = isErrorKey(issue.message)
                ? issue.message
                : OWNER_EDIT_ERRORS.invalidValue;
        }
        return { ok: false, fieldErrors };
    }

    return { ok: true, data: parsed.data };
}
