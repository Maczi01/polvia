'use client';

import { startTransition, useActionState } from 'react';

import { actionFailure, type DraftPin, type RelocateResult } from '@/lib/add-business/types';

import type { ReadyDraft } from '../add-business-flow/flow-state';
import type { Address } from './draft-values';

export type RelocateAction = (
    previous: RelocateResult | null,
    formData: FormData,
) => Promise<RelocateResult>;

interface RelocationState {
    /** Ostatnia odpowiedz — do komunikatu pod przyciskiem. */
    result: RelocateResult | null;
    /** Pin i adres ostatniej UDANEJ relokacji: porazka nie cofa pinu. */
    pin: DraftPin | null;
    geocodedAddress: Address;
}

export interface Relocation extends RelocationState {
    isRelocating: boolean;
    relocate: (address: Address) => void;
}

/** Odrzucenie (siec) nie ma wyniku z serwera: slad w konsoli i ten sam kod co w flow. */
function rejectedRelocation(error: unknown): RelocateResult {
    console.error('add-business relocate action rejected', error);
    return actionFailure('INTERNAL');
}

/**
 * „Sprawdz na mapie" (R8, D10): geokodowanie nowego adresu przez `relocateDraftAction`.
 * Pin w podgladzie zmienia sie dopiero po udanej relokacji, a `geocodedAddress` mowi
 * edytorowi, czy wpisany adres rozni sie od tego, ktory jest na mapie.
 */
export function useRelocation(draft: ReadyDraft, relocateAction: RelocateAction): Relocation {
    const initial: RelocationState = {
        result: null,
        pin: draft.pin,
        geocodedAddress: { street: draft.preview.street ?? '', city: draft.preview.city ?? '' },
    };

    const [state, dispatch, isRelocating] = useActionState(
        async (previous: RelocationState, address: Address): Promise<RelocationState> => {
            const formData = new FormData();
            formData.set('draftId', draft.draftId);
            formData.set('street', address.street);
            formData.set('city', address.city);

            const result = await relocateAction(null, formData).catch(rejectedRelocation);
            if (result.status !== 'relocated') return { ...previous, result };
            return { result, pin: result.pin, geocodedAddress: address };
        },
        initial,
    );

    return {
        ...state,
        isRelocating,
        relocate: address => startTransition(() => dispatch(address)),
    };
}
