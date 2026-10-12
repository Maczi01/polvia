import { z } from 'zod';

/**
 * Klocki walidacji pol formularza „Dodaj firme" — wspolne dla edycji wlasciciela, trybu
 * recznego, relokacji i pod-schematow (`owner-socials-schema`, `owner-pin-schema`,
 * `owner-hours-schema`).
 *
 * Granica `FormData` (docs/solutions/runtime-errors/2026-08-22-zod-coerce-number-puste-formdata.md):
 * `get()` zwraca `null` dla pola nieobecnego i `''` dla pustego — oba normalizujemy do `null`
 * PRZED walidacja, a wymagalnosc wyrazamy w `.superRefine()`.
 *
 * Komunikaty bledow to klucze tlumaczen z namespace `addBusiness`.
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
    /** Link social media prowadzi do innego serwisu niz pole (np. Instagram w polu Facebook). */
    wrongSocialService: 'addBusiness.errors.wrongSocialService',
    /** Numer WhatsApp: dozwolone cyfry, spacje, `+` i `-`; 9–15 cyfr. */
    invalidPhone: 'addBusiness.errors.invalidPhone',
    /** Recznie ustawiona pinezka poza granicami Polski. */
    pinOutsidePoland: 'addBusiness.errors.pinOutsidePoland',
} as const;

export type OwnerEditErrorKey = (typeof OWNER_EDIT_ERRORS)[keyof typeof OWNER_EDIT_ERRORS];

export const emptyToNull = (value: unknown): unknown => {
    const normalized = typeof value === 'string' ? value.trim() : value;
    return normalized === '' || normalized === null || normalized === undefined ? null : normalized;
};

/** `File` w polu tekstowym to podrobiony request — konczy sie bledem pola, nie wyjatkiem. */
export const text = (): z.ZodString =>
    z.string({ invalid_type_error: OWNER_EDIT_ERRORS.invalidValue });

export const optionalText = (max: number) =>
    z.preprocess(emptyToNull, text().max(max, OWNER_EDIT_ERRORS.tooLong).nullable());

export const optionalEmail = z.preprocess(
    emptyToNull,
    text().max(255, OWNER_EDIT_ERRORS.tooLong).email(OWNER_EDIT_ERRORS.invalidEmail).nullable(),
);

export function isHttpUrl(value: string): boolean {
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
