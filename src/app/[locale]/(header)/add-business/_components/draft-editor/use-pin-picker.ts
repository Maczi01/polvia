'use client';

import { useState } from 'react';

import { POLAND_BOUNDS } from '@/lib/add-business/form-limits';
import type { DraftPin } from '@/lib/add-business/types';

import type { ReadyDraft } from '../add-business-flow/flow-state';
import { type RelocateAction, type Relocation, useRelocation } from './use-relocation';

export interface MapPoint {
    lat: number;
    lng: number;
}

interface ManualState {
    point: MapPoint | null;
    /** Ostatni klik byl poza Polska — odrzucony, ale nie kasuje juz ustawionej pinezki. */
    isOutsidePoland: boolean;
}

const NO_MANUAL_PIN: ManualState = { point: null, isOutsidePoland: false };

export interface PinPicker {
    relocation: Relocation;
    /** Pinezka postawiona przez wlasciciela — tylko ona wypelnia `pinLat`/`pinLng`. */
    manualPin: MapPoint | null;
    isOutsidePoland: boolean;
    /** Pin na mapie i w podgladzie: reczny ma pierwszenstwo przed wynikiem wyszukiwania. */
    pin: DraftPin | null;
    pick: (point: MapPoint) => void;
    reset: () => void;
}

/** Ta sama granica co `pinSchema` na serwerze — klik poza nia nie ustawia pinezki. */
export function isInPoland({ lat, lng }: MapPoint): boolean {
    return (
        lat >= POLAND_BOUNDS.minLat &&
        lat <= POLAND_BOUNDS.maxLat &&
        lng >= POLAND_BOUNDS.minLng &&
        lng <= POLAND_BOUNDS.maxLng
    );
}

/**
 * Pinezka edytora (C): wynik wyszukiwania adresu (relokacja zapisuje go w szkicu) albo
 * punkt wskazany recznie. Udane wyszukiwanie zdejmuje reczna pinezke — inaczej mail do
 * operatora dostalby falszywa adnotacje „pin reczny".
 */
export function usePinPicker(draft: ReadyDraft, relocateAction: RelocateAction): PinPicker {
    const [manual, setManual] = useState<ManualState>(NO_MANUAL_PIN);
    const relocation = useRelocation(draft, relocateAction, () => setManual(NO_MANUAL_PIN));
    const manualPin = manual.point;

    return {
        relocation,
        manualPin,
        isOutsidePoland: manual.isOutsidePoland,
        pin: manualPin === null ? relocation.pin : { ...manualPin, approximate: false },
        pick: point =>
            setManual(current =>
                isInPoland(point)
                    ? { point, isOutsidePoland: false }
                    : { ...current, isOutsidePoland: true },
            ),
        reset: () => setManual(NO_MANUAL_PIN),
    };
}
