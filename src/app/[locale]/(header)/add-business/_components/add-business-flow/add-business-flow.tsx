'use client';

import { type JSX, startTransition, useActionState, useOptimistic, useState } from 'react';

import { generateDraftAction, relocateDraftAction, submitDraftAction } from '../../_actions';
import { DraftEditor } from '../draft-editor/draft-editor';
import { DuplicateNotice, LimitedNotice } from '../flow-notices/flow-notices';
import { LinkStep } from '../link-step/link-step';
import { ManualStep } from '../manual-step/manual-step';
import { SubmittedState } from '../submitted-state/submitted-state';
import {
    afterGenerate,
    afterSubmit,
    editingLogo,
    type EditingState,
    type FlowState,
    INITIAL_FLOW,
    type LinkState,
    type ManualState,
    manualStep,
    submittedLogo,
} from './flow-state';
import { useObjectUrl } from './use-object-url';

type FlowEvent =
    | { type: 'generate'; origin: LinkState | ManualState; formData: FormData }
    | { type: 'submit'; origin: EditingState; formData: FormData }
    | { type: 'go'; state: FlowState };

/**
 * Odrzucona akcja (siec, przerwane polaczenie) nie ma kodu z serwera — zamiast wywracac
 * strone do error boundary wracamy do kroku z kodem `INTERNAL`.
 */
async function runFlowEvent(_previous: FlowState, event: FlowEvent): Promise<FlowState> {
    switch (event.type) {
        case 'generate': {
            const result = await generateDraftAction(null, event.formData).catch(() => null);
            return result === null
                ? { ...event.origin, error: 'INTERNAL' }
                : afterGenerate(event.origin, result);
        }
        case 'submit': {
            const result = await submitDraftAction(null, event.formData).catch(() => null);
            return result === null
                ? { ...event.origin, error: 'INTERNAL' }
                : afterSubmit(event.origin, result);
        }
        case 'go':
            return event.state;
    }
}

/**
 * Flow „Dodaj firme" (U9): link → (tryb reczny) → podglad + edycja → podziekowanie,
 * plus duplikat i limit. Stan to jedna unia (`flow-state.ts`) trzymana przez
 * `useActionState`; `useOptimistic` pokazuje `generating`/`submitting`, dopoki akcja
 * trwa, i sam wraca do wyniku, gdy sie skonczy.
 *
 * Krok formularza renderuje sie w tym samym miejscu drzewa w stanie bezczynnym
 * i w trakcie akcji, wiec wpisane wartosci przetrwaja odrzucenie przez serwer.
 */
export function AddBusinessFlow(): JSX.Element {
    const [flow, dispatch] = useActionState(runFlowEvent, INITIAL_FLOW);
    const [view, showPending] = useOptimistic(flow);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const logoUrl = useObjectUrl(logoFile);

    function send(event: FlowEvent, pending: FlowState | null): void {
        startTransition(() => {
            if (pending !== null) showPending(pending);
            dispatch(event);
        });
    }

    function goTo(state: FlowState): void {
        setLogoFile(null);
        send({ type: 'go', state }, null);
    }

    const screen = view.step === 'generating' || view.step === 'submitting' ? view.origin : view;
    const isPending = view.step === 'generating' || view.step === 'submitting';

    switch (screen.step) {
        case 'link':
            return (
                <LinkStep
                    fieldErrors={screen.fieldErrors}
                    error={screen.error}
                    isPending={isPending}
                    shouldFocusHeading={screen.error !== null}
                    onGenerate={formData =>
                        send(
                            { type: 'generate', origin: screen, formData },
                            { step: 'generating', origin: screen },
                        )
                    }
                    onManual={() => goTo(manualStep(null, null))}
                />
            );
        case 'manual':
            return (
                <ManualStep
                    reason={screen.reason}
                    prefillLink={screen.prefillLink}
                    fieldErrors={screen.fieldErrors}
                    error={screen.error}
                    isPending={isPending}
                    onGenerate={formData =>
                        send(
                            { type: 'generate', origin: screen, formData },
                            { step: 'generating', origin: screen },
                        )
                    }
                    onBack={() => goTo(INITIAL_FLOW)}
                />
            );
        case 'editing':
            return (
                <DraftEditor
                    draft={screen.draft}
                    fieldErrors={screen.fieldErrors}
                    error={screen.error}
                    isPending={isPending}
                    logoSrc={editingLogo(logoUrl, screen.draft)}
                    onLogoChange={setLogoFile}
                    onSubmit={formData =>
                        send(
                            { type: 'submit', origin: screen, formData },
                            { step: 'submitting', origin: screen },
                        )
                    }
                    onStartOver={() => goTo(INITIAL_FLOW)}
                    relocateAction={relocateDraftAction}
                />
            );
        case 'submitted':
            return (
                <SubmittedState
                    card={screen.card}
                    unconfirmed={screen.unconfirmed}
                    pin={screen.pin}
                    logoSrc={submittedLogo(logoUrl, screen)}
                />
            );
        case 'duplicate':
            return (
                <DuplicateNotice
                    name={screen.name}
                    slug={screen.slug}
                    onStartOver={() => goTo(INITIAL_FLOW)}
                />
            );
        case 'limited':
            return <LimitedNotice retryAfter={screen.retryAfter} />;
    }
}
