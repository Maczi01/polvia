import { LOGO_ACCEPTED_TYPES, LOGO_MAX_BYTES } from '@/lib/add-business/form-limits';
import { EXTRA_FIELD_ERRORS, type FieldErrorKey } from '@/lib/add-business/types';

/**
 * Wczesna kontrola logo przed wysylka: plik ponad limit odbilby sie na `bodySizeLimit`
 * akcji i wrocil jako ogolne `INTERNAL`, zamiast bledu pola. Klucze sa te same co
 * w odpowiedzi serwera (`LOGO_TOO_LARGE`, `INVALID_LOGO`).
 *
 * Pusty `file.type` (przegladarka nie rozpoznala rozszerzenia) przepuszczamy — serwer
 * i tak rozpoznaje format z tresci pliku.
 */
/** Poszerzenie krotki do `string[]`, zeby `includes` przyjal dowolny `file.type`. */
const ACCEPTED_TYPES: readonly string[] = LOGO_ACCEPTED_TYPES;

export function logoFileError(file: File): FieldErrorKey | null {
    if (file.size > LOGO_MAX_BYTES) return EXTRA_FIELD_ERRORS.logoTooLarge;
    if (file.type !== '' && !ACCEPTED_TYPES.includes(file.type)) {
        return EXTRA_FIELD_ERRORS.invalidLogo;
    }
    return null;
}
