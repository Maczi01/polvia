import type { FactField } from '@/lib/add-business/draft-schema';
import type {
    ActionErrorCode,
    BusinessPreview,
    DraftPin,
    FieldErrors,
    GenerateDraftResult,
    ManualReason,
    SubmitDraftResult,
} from '@/lib/add-business/types';

/**
 * Maszyna stanow flow „Dodaj firme" jako jedna unia po `step` (regula 13: bez
 * boolowskich flag). `generating` i `submitting` pamietaja krok, z ktorego wyszly —
 * formularz zostaje zamontowany, a odrzucenie wraca do niego z bledami.
 *
 * Funkcje `after*` to czyste przejscia: wynik akcji → nastepny stan. Komponent tylko je
 * wywoluje, wiec cala logika przejsc jest testowalna bez renderu.
 */

export type ReadyDraft = Extract<GenerateDraftResult, { status: 'ready' }>;

export interface LinkState {
    step: 'link';
    fieldErrors: FieldErrors;
    error: ActionErrorCode | null;
}

export interface ManualState {
    step: 'manual';
    reason: ManualReason | null;
    prefillLink: string | null;
    fieldErrors: FieldErrors;
    error: ActionErrorCode | null;
}

export interface EditingState {
    step: 'editing';
    draft: ReadyDraft;
    fieldErrors: FieldErrors;
    error: ActionErrorCode | null;
}

export interface SubmittedState {
    step: 'submitted';
    card: BusinessPreview;
    unconfirmed: FactField[];
    pin: DraftPin | null;
    hasLogo: boolean;
    logoCandidate: string | null;
}

export type FlowState =
    | LinkState
    | { step: 'generating'; origin: LinkState | ManualState }
    | ManualState
    | EditingState
    | { step: 'submitting'; origin: EditingState }
    | SubmittedState
    | { step: 'duplicate'; name: string; slug: string }
    | { step: 'limited'; retryAfter: number };

export const INITIAL_FLOW: LinkState = { step: 'link', fieldErrors: {}, error: null };

export function linkWithError(error: ActionErrorCode): LinkState {
    return { step: 'link', fieldErrors: {}, error };
}

export function manualStep(reason: ManualReason | null, prefillLink: string | null): ManualState {
    return { step: 'manual', reason, prefillLink, fieldErrors: {}, error: null };
}

/** Bez bledow, ktore pokazywal krok przed ponowna proba. */
function cleared<State extends LinkState | ManualState | EditingState>(origin: State): State {
    return { ...origin, fieldErrors: {}, error: null };
}

/**
 * Odrzucona akcja (siec, przerwane polaczenie) nie ma wyniku z serwera: wracamy do kroku
 * z `INTERNAL`, bez bledow pol z poprzedniej proby — te dotyczyly innej wysylki.
 */
export function afterRejection<State extends LinkState | ManualState | EditingState>(
    origin: State,
): State {
    return { ...cleared(origin), error: 'INTERNAL' };
}

export function afterGenerate(
    origin: LinkState | ManualState,
    result: GenerateDraftResult,
): FlowState {
    switch (result.status) {
        case 'ready':
            return { step: 'editing', draft: result, fieldErrors: {}, error: null };
        case 'duplicate':
            return { step: 'duplicate', name: result.name, slug: result.slug };
        case 'needsManual':
            return manualStep(result.reason, result.prefill.link);
        case 'limited':
            return { step: 'limited', retryAfter: result.retryAfter };
        case 'invalid':
            return { ...cleared(origin), fieldErrors: result.fieldErrors };
        case 'error':
            return { ...cleared(origin), error: result.error.code };
    }
}

/**
 * Po tych kodach szkicu juz nie ma (wygasl albo `consumeDraft` go zuzyl przed mailem),
 * wiec ponowna wysylka z edytora skonczylaby sie `DRAFT_EXPIRED` — wracamy do linku.
 */
const DRAFT_GONE: ReadonlySet<ActionErrorCode> = new Set<ActionErrorCode>([
    'DRAFT_EXPIRED',
    'SEND_FAILED',
    'INVALID_ENTRY',
]);

export function afterSubmit(origin: EditingState, result: SubmitDraftResult): FlowState {
    switch (result.status) {
        case 'sent':
            return {
                step: 'submitted',
                card: result.card,
                unconfirmed: result.unconfirmed,
                pin: result.pin,
                hasLogo: result.hasLogo,
                logoCandidate: origin.draft.logoCandidate,
            };
        case 'limited':
            return { step: 'limited', retryAfter: result.retryAfter };
        case 'invalid':
            return { ...cleared(origin), fieldErrors: result.fieldErrors };
        case 'error':
            return DRAFT_GONE.has(result.error.code)
                ? linkWithError(result.error.code)
                : { ...cleared(origin), error: result.error.code };
    }
}

/** Logo kolejno: wlasny upload → kandydat ze strony → placeholder karty (`null`). */
export function editingLogo(uploadUrl: string | null, draft: ReadyDraft): string | null {
    return uploadUrl ?? draft.logoCandidate;
}

/** Po wysylce logo pokazujemy tylko wtedy, gdy faktycznie trafilo do zgloszenia. */
export function submittedLogo(uploadUrl: string | null, state: SubmittedState): string | null {
    return state.hasLogo ? (uploadUrl ?? state.logoCandidate) : null;
}
