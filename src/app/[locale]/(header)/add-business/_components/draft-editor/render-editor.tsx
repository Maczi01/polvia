import { act, type RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ReadyDraft } from '../add-business-flow/flow-state';
import { PIN_FIXTURE, PREVIEW_FIXTURE } from '../business-card-preview/preview-fixture';
import { renderWithIntl } from '../test-utils/render-with-intl';
import { DraftEditor, type DraftEditorProps } from './draft-editor';

/**
 * Wspolny render edytora dla jego testow. Mapa laduje sie przez `next/dynamic`
 * (`React.lazy`), wiec render czeka w async `act`, az leniwy modul sie rozwiaze.
 * Testy musza zamockowac `react-map-gl/mapbox` (`../test-utils/map-gl-mock`).
 */

export const EDITOR_DRAFT: ReadyDraft = {
    status: 'ready',
    draftId: 'draft-1',
    preview: { ...PREVIEW_FIXTURE, phoneNumber: null },
    unconfirmed: ['phoneNumber'],
    logoCandidate: null,
    pin: PIN_FIXTURE,
};

interface RenderedEditor extends RenderResult {
    props: DraftEditorProps;
}

export async function renderEditor(
    overrides: Partial<DraftEditorProps> = {},
): Promise<RenderedEditor> {
    const props: DraftEditorProps = {
        draft: EDITOR_DRAFT,
        fieldErrors: {},
        error: null,
        isPending: false,
        logoSrc: null,
        onLogoChange: jest.fn(),
        onSubmit: jest.fn(),
        onStartOver: jest.fn(),
        relocateAction: jest.fn(),
        ...overrides,
    };
    let result: RenderResult | undefined;
    await act(async () => {
        result = renderWithIntl(<DraftEditor {...props} />);
    });
    if (result === undefined) throw new Error('render edytora nie zwrocil wyniku');
    return { ...result, props };
}

export async function submitEditor(): Promise<void> {
    await userEvent.type(
        screen.getByRole('textbox', { name: 'Twój e-mail (wymagane)' }),
        'wlasciciel@firma.pl',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));
}
