import { z } from 'zod';

import type { DraftFacts } from '@/lib/add-business/draft-schema';
import {
    OWNER_EDIT_ERRORS,
    optionalEmail,
    optionalText,
    optionalWebpage,
} from '@/lib/add-business/owner-edits-schema';
import { EXTRA_FIELD_ERRORS, type FieldErrorKey, type FieldErrors } from '@/lib/add-business/types';

/**
 * Formularz trybu recznego (R6): pola kluczowe + opis dzialalnosci, z ktorego model pisze
 * klasyfikacje, tagi i opisy. Godziny otwarcia wlasciciel uzupelnia w kroku edycji
 * (trafiaja do `unconfirmed`, jak kazde puste pole).
 *
 * Granica `FormData`: puste pole i pole nieobecne to `null` przed walidacja (te same
 * helpery co `parseOwnerEdits`), wymagalnosc w `.superRefine()`.
 */

export const MANUAL_DESCRIPTION_MIN = 50;
export const MANUAL_DESCRIPTION_MAX = 1000;

export interface ManualInput {
    fields: DraftFacts;
    description: string;
    link: string | null;
}

export type ManualInputResult =
    | { ok: true; data: ManualInput }
    | { ok: false; fieldErrors: FieldErrors };

const REQUIRED_FIELDS = ['name', 'city', 'description'] as const;

const manualSchema = z
    .object({
        name: optionalText(255),
        street: optionalText(255),
        postcode: optionalText(20),
        city: optionalText(255),
        phoneNumber: optionalText(50),
        email: optionalEmail,
        link: optionalWebpage,
        description: optionalText(MANUAL_DESCRIPTION_MAX),
    })
    .superRefine((input, ctx) => {
        for (const field of REQUIRED_FIELDS) {
            if (input[field] !== null) continue;
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [field],
                message: OWNER_EDIT_ERRORS.required,
            });
        }
        if (input.description !== null && input.description.length < MANUAL_DESCRIPTION_MIN) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['description'],
                message: EXTRA_FIELD_ERRORS.tooShort,
            });
        }
    })
    // Transform nie odpala po bledzie `superRefine` — warunek tylko zaweza `string | null`.
    .transform((input, ctx): ManualInput => {
        const { description, link, ...facts } = input;
        if (description === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['description'],
                message: OWNER_EDIT_ERRORS.required,
            });
            return z.NEVER;
        }
        return { fields: { ...facts, openingHours: null }, description, link };
    });

const ERROR_KEYS = new Set<string>([
    ...Object.values(OWNER_EDIT_ERRORS),
    ...Object.values(EXTRA_FIELD_ERRORS),
]);

function isFieldErrorKey(message: string): message is FieldErrorKey {
    return ERROR_KEYS.has(message);
}

/** Bledy Zoda → bledy pol formularza; komunikat spoza znanych kluczy to `invalidValue`. */
export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
    const fieldErrors: FieldErrors = {};
    for (const issue of error.issues) {
        fieldErrors[issue.path.join('.')] ??= isFieldErrorKey(issue.message)
            ? issue.message
            : OWNER_EDIT_ERRORS.invalidValue;
    }
    return fieldErrors;
}

export function parseManualInput(formData: FormData): ManualInputResult {
    const field = (name: string) => formData.get(name);
    const parsed = manualSchema.safeParse({
        name: field('name'),
        street: field('street'),
        postcode: field('postcode'),
        city: field('city'),
        phoneNumber: field('phoneNumber'),
        email: field('email'),
        link: field('link'),
        description: field('description'),
    });

    if (parsed.success) return { ok: true, data: parsed.data };
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
}
