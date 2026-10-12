import 'server-only';

import { z } from 'zod';

import { withActionBoundary } from '@/lib/add-business/action-errors';
import type { Geocode } from '@/lib/add-business/draft-geo';
import {
    getDraft,
    reserveRelocation,
    toDraftGeo,
    updateDraftGeo,
} from '@/lib/add-business/draft-store';
import { fieldErrorsFromZod } from '@/lib/add-business/manual-input-schema';
import { OWNER_EDIT_ERRORS, optionalText } from '@/lib/add-business/owner-edits-schema';
import {
    actionFailure,
    GEOCODE_ERROR_TO_ACTION,
    type RelocateResult,
} from '@/lib/add-business/types';

/**
 * „Sprawdz na mapie" (R8, D10): geokoduje nowy adres i podmienia `geo` szkicu, zeby submit
 * nie geokodowal go drugi raz. Kolejnosc: szkic istnieje → rezerwacja relokacji (limit 10
 * na szkic, D7) → geokodowanie → zapis. Rezerwacja przed geokodowaniem, bo to ono kosztuje
 * (Nominatim 1 req/s).
 */

export interface RelocateDeps {
    geocode: Geocode;
}

const relocateSchema = z
    .object({
        draftId: z.string({ invalid_type_error: OWNER_EDIT_ERRORS.invalidValue }),
        street: optionalText(255),
        city: optionalText(255),
    })
    // Miasto wymagane; transform zaweza `string | null` do `string` bez `!`.
    .transform((input, ctx) => {
        const { city } = input;
        if (city === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['city'],
                message: OWNER_EDIT_ERRORS.required,
            });
            return z.NEVER;
        }
        return { ...input, city };
    });

async function relocate(formData: FormData, deps: RelocateDeps): Promise<RelocateResult> {
    const parsed = relocateSchema.safeParse({
        draftId: formData.get('draftId'),
        street: formData.get('street'),
        city: formData.get('city'),
    });
    if (!parsed.success) {
        return { status: 'invalid', fieldErrors: fieldErrorsFromZod(parsed.error) };
    }
    const { draftId, street, city } = parsed.data;

    const current = await getDraft(draftId);
    if (!current.ok) return actionFailure(current.code);

    const reservation = await reserveRelocation(draftId);
    if (!reservation.ok) return actionFailure(reservation.code);

    const address = { street, city };
    const geocoded = await deps.geocode(address);
    if (!geocoded.ok) return actionFailure(GEOCODE_ERROR_TO_ACTION[geocoded.code]);

    const geo = toDraftGeo(geocoded, address);
    const written = await updateDraftGeo(draftId, geo);
    if (!written.ok) return actionFailure(written.code);

    const pin = { lat: geo.lat, lng: geo.lng, approximate: geo.approximate };
    return { status: 'relocated', pin, remainingRelocations: reservation.remaining };
}

export async function relocateDraft(
    formData: FormData,
    deps: RelocateDeps,
): Promise<RelocateResult> {
    return withActionBoundary('relocateDraft', () => relocate(formData, deps));
}
