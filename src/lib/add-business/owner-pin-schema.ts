import { z } from 'zod';

import { POLAND_BOUNDS } from '@/lib/add-business/form-limits';
import { emptyToNull, OWNER_EDIT_ERRORS } from '@/lib/add-business/owner-edit-fields';

/**
 * Recznie ustawiona pinezka (C): pola `pinLat`, `pinLng` — oba albo zadne. Kazdy blad
 * (zla liczba, brak pary, poza Polska) to blad pola `pin`, bo UI ma jedna mape, nie dwa
 * inputy.
 *
 * `''` i brak pola to „pinezki nie ustawiono", nie `0` — `Number('')` dalby 0 i wpis na
 * Zatoce Gwinejskiej (docs/solutions/runtime-errors/2026-08-22-zod-coerce-number-puste-formdata.md).
 */

export { POLAND_BOUNDS } from './form-limits';

export interface ManualPin {
    lat: number;
    lng: number;
}

type Coordinate = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'value'; value: number };

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

function parseCoordinate(raw: unknown): Coordinate {
    const value = emptyToNull(raw);
    if (value === null) return { kind: 'empty' };
    if (typeof value !== 'string' || !NUMBER_PATTERN.test(value)) return { kind: 'invalid' };
    const parsed = Number(value);
    return Number.isFinite(parsed) ? { kind: 'value', value: parsed } : { kind: 'invalid' };
}

function isInPoland({ lat, lng }: ManualPin): boolean {
    return (
        lat >= POLAND_BOUNDS.minLat &&
        lat <= POLAND_BOUNDS.maxLat &&
        lng >= POLAND_BOUNDS.minLng &&
        lng <= POLAND_BOUNDS.maxLng
    );
}

function failPin(ctx: z.RefinementCtx, message: string): typeof z.NEVER {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER;
}

/** Wejscie: `{ lat: formData.get('pinLat'), lng: formData.get('pinLng') }`. */
export const pinSchema = z
    .object({ lat: z.unknown(), lng: z.unknown() })
    .transform((raw, ctx): ManualPin | null => {
        const lat = parseCoordinate(raw.lat);
        const lng = parseCoordinate(raw.lng);
        if (lat.kind === 'empty' && lng.kind === 'empty') return null;
        if (lat.kind !== 'value' || lng.kind !== 'value') {
            return failPin(ctx, OWNER_EDIT_ERRORS.invalidValue);
        }

        const pin = { lat: lat.value, lng: lng.value };
        return isInPoland(pin) ? pin : failPin(ctx, OWNER_EDIT_ERRORS.pinOutsidePoland);
    });
