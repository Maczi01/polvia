import { z } from 'zod';

import {
    LANGUAGE_CODES,
    type LanguageCode,
    NOTES_MAX_LENGTH,
} from '@/lib/add-business/form-limits';
import type { OpeningHours } from '@/lib/add-business/jsonld-facts';
import {
    OWNER_EDIT_ERRORS,
    type OwnerEditErrorKey,
    optionalEmail,
    optionalText,
    optionalWebpage,
} from '@/lib/add-business/owner-edit-fields';
import { ownerHoursSchema, readHoursFields } from '@/lib/add-business/owner-hours-schema';
import { type ManualPin, pinSchema } from '@/lib/add-business/owner-pin-schema';
import {
    readSocialFields,
    resolveWhatsapp,
    socialsSchema,
    whatsappNumberSchema,
} from '@/lib/add-business/owner-socials-schema';
import type { Socials } from '@/lib/add-business/social-links';

/** Reeksport z lekkiego modulu `form-limits` — klient importuje stale stamtad. */
export { NOTES_MAX_LENGTH } from '@/lib/add-business/form-limits';
/** Reeksport — dotychczasowi importerzy biora klocki pol stad. */
export {
    OWNER_EDIT_ERRORS,
    type OwnerEditErrorKey,
    optionalEmail,
    optionalText,
    optionalWebpage,
} from '@/lib/add-business/owner-edit-fields';

/**
 * Pola, ktore wlasciciel moze poprawic przed wysylka (R9: kategoria, zasieg, tagi i opisy
 * nie sa tu obecne — pochodza wylacznie ze szkicu w Redis).
 *
 * Formularz jest wstepnie wypelniony wartosciami szkicu, wiec wynik to KOMPLETNY stan pol
 * po edycji, a nie lista roznic: pole wyczyszczone przez wlasciciela przychodzi jako `null`.
 */

export interface OwnerEdits {
    name: string;
    street: string | null;
    postcode: string | null;
    city: string;
    phoneNumber: string | null;
    email: string | null;
    webpage: string | null;
    /** Ksztalt `serviceInputSchema`; `null` gdy checkbox godzin odznaczony albo zaden dzien. */
    openingHours: OpeningHours | null;
    languages: LanguageCode[];
    /** Tylko niepuste linki, juz jako pelne URL-e serwisow. */
    socials: Socials;
    /** `+<cyfry>` — z pola `whatsappNumber` albo z linku `wa.me/<cyfry>`. */
    whatsappNumber: string | null;
    /** Pinezka ustawiona recznie na mapie; `null` = wspolrzedne ze szkicu / geokodowania. */
    pin: ManualPin | null;
    submitterEmail: string;
    notes: string | null;
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
        hours: ownerHoursSchema,
        languages: z.array(
            z.enum(LANGUAGE_CODES, {
                errorMap: () => ({ message: OWNER_EDIT_ERRORS.invalidLanguage }),
            }),
        ),
        socials: socialsSchema,
        whatsappNumber: whatsappNumberSchema,
        pin: pinSchema,
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
    })
    // Zod pomija transform, gdy `superRefine` zglosil blad, wiec ponizszy warunek nie
    // odpali w praktyce — sluzy zawezeniu `string | null` do `string` bez `!` i `as`.
    .transform((input, ctx): OwnerEdits => {
        const { name, city, submitterEmail, hours, languages, socials, whatsappNumber, ...rest } =
            input;
        if (name === null || city === null || submitterEmail === null) {
            addRequiredIssues(input, ctx);
            return z.NEVER;
        }

        return {
            ...rest,
            ...resolveWhatsapp(socials, whatsappNumber),
            name,
            city,
            submitterEmail,
            languages: [...new Set(languages)],
            openingHours: hours,
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
        hours: readHoursFields(formData),
        languages: formData.getAll('languages'),
        socials: readSocialFields(formData),
        whatsappNumber: field('whatsappNumber'),
        pin: { lat: field('pinLat'), lng: field('pinLng') },
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
