import { z } from 'zod';

import { TIME_PATTERN, WEEKDAY_KEYS } from '@/db/service-input-schema';
import type { OpeningHours } from '@/lib/add-business/jsonld-facts';
import { emptyToNull, OWNER_EDIT_ERRORS, text } from '@/lib/add-business/owner-edit-fields';

/**
 * Godziny otwarcia w formularzu edycji (B). Checkbox `hoursEnabled` (`'on'`, gdy zaznaczony;
 * niezaznaczony checkbox nie trafia do `FormData`) decyduje, czy wpis ma godziny:
 * - brak → `null` (wpis bez godzin: `openingHours` pominiete w JSON-ie, `db:add` zapisze `{}`),
 *   pola `hours.*` sa ignorowane razem z ewentualnymi bledami;
 * - `'on'` → pary `hours.<dzien>.open/close`; pusta para = dzien nieczynny.
 */

/** Wartosc zaznaczonego checkboxa bez atrybutu `value`. */
export const HOURS_ENABLED_VALUE = 'on';

const optionalTime = z.preprocess(
    emptyToNull,
    text().regex(TIME_PATTERN, OWNER_EDIT_ERRORS.invalidTime).nullable(),
);

const dayPairSchema = z.object({ open: optionalTime, close: optionalTime });

const daysSchema = z.object({
    monday: dayPairSchema,
    tuesday: dayPairSchema,
    wednesday: dayPairSchema,
    thursday: dayPairSchema,
    friday: dayPairSchema,
    saturday: dayPairSchema,
    sunday: dayPairSchema,
});

type DaysInput = z.infer<typeof daysSchema>;

/** Pusta para = dzien nieczynny. Polowa pary to niedokonczona edycja, nie "zamkniete". */
function addIncompleteIssues(days: DaysInput, ctx: z.RefinementCtx): void {
    for (const day of WEEKDAY_KEYS) {
        const { open, close } = days[day];
        if ((open === null) === (close === null)) continue;
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [day, open === null ? 'open' : 'close'],
            message: OWNER_EDIT_ERRORS.incompleteHours,
        });
    }
}

function toOpeningHours(days: DaysInput): OpeningHours | null {
    const result: OpeningHours = {};
    for (const day of WEEKDAY_KEYS) {
        const { open, close } = days[day];
        if (open !== null && close !== null) result[day] = { open, close };
    }
    return Object.keys(result).length > 0 ? result : null;
}

function enabledDays(raw: unknown): unknown {
    if (typeof raw !== 'object' || raw === null) return null;
    const enabled = 'enabled' in raw ? raw.enabled : null;
    const days = 'days' in raw ? raw.days : null;
    return enabled === HOURS_ENABLED_VALUE ? days : null;
}

/**
 * Wejscie: `readHoursFields(formData)`. Bledy maja sciezke `<dzien>.<open|close>` wzgledem
 * pola — pod kluczem `hours` daje to nazwe pola formularza `hours.monday.open`.
 */
export const ownerHoursSchema = z.preprocess(
    enabledDays,
    daysSchema.superRefine(addIncompleteIssues).transform(toOpeningHours).nullable(),
);

export function readHoursFields(formData: FormData): { enabled: unknown; days: unknown } {
    const field = (name: string) => formData.get(name);
    return {
        enabled: field('hoursEnabled'),
        days: Object.fromEntries(
            WEEKDAY_KEYS.map(day => [
                day,
                { open: field(`hours.${day}.open`), close: field(`hours.${day}.close`) },
            ]),
        ),
    };
}
