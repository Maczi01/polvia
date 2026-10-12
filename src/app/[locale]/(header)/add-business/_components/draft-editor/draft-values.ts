import type { FactField } from '@/lib/add-business/draft-schema';
import { type LanguageCode, SOCIAL_KEYS, type SocialKey } from '@/lib/add-business/form-limits';
import { type BusinessPreview, hasOpeningHours } from '@/lib/add-business/types';
import { WEEKDAY_KEYS, type Weekday } from '@/lib/weekdays';

/**
 * Stan pol edytora (R8) i jego rzut na podglad karty. Pola tekstowe trzymaja napis
 * (`''` = puste) — tak samo jak `FormData`, ktore serwer normalizuje przez `emptyToNull`.
 */

export interface DayHoursValue {
    open: string;
    close: string;
}

export type HoursValues = Record<Weekday, DayHoursValue>;

export const TEXT_FIELDS = [
    'name',
    'street',
    'postcode',
    'city',
    'phoneNumber',
    'email',
    'webpage',
] as const;

export type TextFieldName = (typeof TEXT_FIELDS)[number];

/** Wpisane napisy pol `socials.<klucz>`; brak klucza = puste pole. */
export type SocialValues = Partial<Record<SocialKey, string>>;

export type DraftValues = Record<TextFieldName, string> & {
    /** Checkbox `hoursEnabled`: odznaczony = wpis bez godzin, pola `hours.*` nie ida. */
    hoursEnabled: boolean;
    hours: HoursValues;
    languages: LanguageCode[];
    socials: SocialValues;
    whatsappNumber: string;
};

export interface Address {
    street: string;
    city: string;
}

export function initialValues(preview: BusinessPreview): DraftValues {
    const hours = Object.fromEntries(
        WEEKDAY_KEYS.map(day => {
            const value = preview.openingHours?.[day];
            return [day, { open: value?.open ?? '', close: value?.close ?? '' }];
        }),
    );
    return {
        name: preview.name ?? '',
        street: preview.street ?? '',
        postcode: preview.postcode ?? '',
        city: preview.city ?? '',
        phoneNumber: preview.phoneNumber ?? '',
        email: preview.email ?? '',
        webpage: preview.webpage ?? '',
        hoursEnabled: hasOpeningHours(preview.openingHours),
        hours: { ...emptyHours(), ...hours },
        languages: [...preview.languages],
        socials: { ...preview.socials },
        whatsappNumber: preview.whatsappNumber ?? '',
    };
}

function emptyHours(): HoursValues {
    return {
        monday: { open: '', close: '' },
        tuesday: { open: '', close: '' },
        wednesday: { open: '', close: '' },
        thursday: { open: '', close: '' },
        friday: { open: '', close: '' },
        saturday: { open: '', close: '' },
        sunday: { open: '', close: '' },
    };
}

function orNull(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

/** Dzien bez pelnej pary godzin nie trafia na karte — tak samo liczy `parseOwnerEdits`. */
function openingHoursOf(hours: HoursValues): BusinessPreview['openingHours'] {
    const result: Record<string, DayHoursValue> = {};
    for (const day of WEEKDAY_KEYS) {
        const { open, close } = hours[day];
        if (open !== '' && close !== '') result[day] = { open, close };
    }
    return Object.keys(result).length > 0 ? result : null;
}

function socialsOf(values: SocialValues): BusinessPreview['socials'] {
    const result: BusinessPreview['socials'] = {};
    for (const key of SOCIAL_KEYS) {
        const value = orNull(values[key] ?? '');
        if (value !== null) result[key] = value;
    }
    return result;
}

/** Podglad po edycji: kategoria, zasieg, tagi i opisy zostaja ze szkicu (R9). */
export function previewFromValues(preview: BusinessPreview, values: DraftValues): BusinessPreview {
    return {
        ...preview,
        name: orNull(values.name),
        street: orNull(values.street),
        postcode: orNull(values.postcode),
        city: orNull(values.city),
        phoneNumber: orNull(values.phoneNumber),
        email: orNull(values.email),
        webpage: orNull(values.webpage),
        openingHours: values.hoursEnabled ? openingHoursOf(values.hours) : null,
        languages: values.languages,
        socials: socialsOf(values.socials),
        whatsappNumber: orNull(values.whatsappNumber),
    };
}

/** Pola z `unconfirmed`, ktorych wlasciciel jeszcze nie uzupelnil. */
export function stillUnconfirmed(
    unconfirmed: readonly FactField[],
    preview: BusinessPreview,
): FactField[] {
    return unconfirmed.filter(field => preview[field] === null);
}

export function addressOf(values: Pick<DraftValues, 'street' | 'city'>): Address {
    return { street: values.street.trim(), city: values.city.trim() };
}

/** Porownanie jak w `submit-draft.ts` (`sameText`): bez wielkosci liter i bialych znakow. */
export function sameAddress(a: Address, b: Address): boolean {
    const norm = (value: string): string => value.trim().toLowerCase();
    return norm(a.street) === norm(b.street) && norm(a.city) === norm(b.city);
}
