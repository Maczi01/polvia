import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { ReadyDraft } from '../add-business-flow/flow-state';
import { PIN_FIXTURE, PREVIEW_FIXTURE } from '../business-card-preview/preview-fixture';
import { renderWithIntl } from '../test-utils/render-with-intl';
import { DraftEditor, type DraftEditorProps } from './draft-editor';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));

const DRAFT: ReadyDraft = {
    status: 'ready',
    draftId: 'draft-1',
    preview: { ...PREVIEW_FIXTURE, phoneNumber: null },
    unconfirmed: ['phoneNumber'],
    logoCandidate: null,
    pin: PIN_FIXTURE,
};

function renderEditor(overrides: Partial<DraftEditorProps> = {}) {
    const props: DraftEditorProps = {
        draft: DRAFT,
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
    return { ...renderWithIntl(<DraftEditor {...props} />), props };
}

const relocateButton = () => screen.getByRole('button', { name: 'Sprawdź na mapie' });

describe('<DraftEditor />', () => {
    it('kategoria, zasieg i tagi sa tekstem bez kontrolki formularza', () => {
        renderEditor();

        expect(screen.queryByRole('combobox', { name: /Kategoria/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /Kategoria/ })).not.toBeInTheDocument();
        const summary = screen.getByRole('region', { name: 'Przygotowane przez nas' });
        expect(within(summary).getByText('Gastronomia')).toBeInTheDocument();
        expect(within(summary).getByText('Na miejscu i online')).toBeInTheDocument();
        expect(
            within(summary).getByText('Wybierane przez nas; uwagi możesz zgłosić niżej.'),
        ).toBeInTheDocument();
    });

    it('blad e-maila jest podpiety przez aria-describedby', () => {
        renderEditor({ fieldErrors: { submitterEmail: 'addBusiness.errors.invalidEmail' } });

        const input = screen.getByRole('textbox', { name: 'Twój e-mail (wymagane)' });
        expect(input).toBeInvalid();
        expect(input).toHaveAccessibleDescription(/Wpisz poprawny adres e-mail\./);
        expect(screen.getByRole('alert')).toHaveTextContent('Popraw zaznaczone pola');
    });

    it('uzupelnienie pola zdejmuje znacznik w podgladzie', async () => {
        renderEditor();
        expect(screen.getByText('do uzupełnienia')).toBeInTheDocument();

        await userEvent.type(screen.getByRole('textbox', { name: 'Telefon' }), '+48 500 600 700');

        expect(screen.queryByText('do uzupełnienia')).not.toBeInTheDocument();
        expect(screen.getAllByText('+48 500 600 700').length).toBeGreaterThan(0);
    });

    it('zmiana adresu wlacza „Sprawdz na mapie", ktore przesuwa pin', async () => {
        const relocateAction = jest.fn().mockResolvedValue({
            status: 'relocated',
            pin: { lat: 54.4, lng: 18.6, approximate: true },
            remainingRelocations: 9,
        });
        renderEditor({ relocateAction });
        expect(relocateButton()).toHaveAttribute('aria-disabled', 'true');

        const street = screen.getByRole('textbox', { name: 'Ulica i numer' });
        await userEvent.clear(street);
        await userEvent.type(street, 'ul. Długa 5');
        expect(relocateButton()).toHaveAttribute('aria-disabled', 'false');
        await userEvent.click(relocateButton());

        await waitFor(() =>
            expect(
                screen.getByText('Pinezka przesunięta. Pozostało sprawdzeń: 9.'),
            ).toBeInTheDocument(),
        );
        const formData: FormData = relocateAction.mock.calls[0][1];
        expect(formData.get('draftId')).toBe('draft-1');
        expect(formData.get('street')).toBe('ul. Długa 5');
        expect(formData.get('city')).toBe('Gdańsk');
        expect(screen.getByText(/Pinezka jest przybliżona/)).toBeInTheDocument();
        expect(relocateButton()).toHaveAttribute('aria-disabled', 'true');
    });

    it('blad relokacji jest ogloszony, a pin zostaje', async () => {
        const relocateAction = jest.fn().mockResolvedValue({
            status: 'error',
            error: { code: 'ADDRESS_NOT_FOUND', message: 'x' },
        });
        renderEditor({ relocateAction });

        await userEvent.type(screen.getByRole('textbox', { name: 'Ulica i numer' }), 'x');
        await userEvent.click(relocateButton());

        await waitFor(() =>
            expect(
                screen.getByText('Nie znaleźliśmy tego adresu na mapie. Sprawdź ulicę i miasto.'),
            ).toBeInTheDocument(),
        );
        expect(screen.getByRole('img', { name: /Mapa z pinezką/ })).toBeInTheDocument();
    });

    it('wysyla pola pod nazwami z parseOwnerEdits', async () => {
        const onSubmit = jest.fn();
        renderEditor({ onSubmit });

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Twój e-mail (wymagane)' }),
            'wlasciciel@firma.pl',
        );
        await userEvent.click(screen.getByRole('checkbox', { name: 'angielski' }));
        await userEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

        const formData: FormData = onSubmit.mock.calls[0][0];
        expect(formData.get('draftId')).toBe('draft-1');
        expect(formData.get('name')).toBe('Kawiarnia Lwów');
        expect(formData.get('hours.monday.open')).toBe('09:00');
        expect(formData.getAll('languages')).toEqual(['pl', 'uk', 'en']);
        expect(formData.get('submitterEmail')).toBe('wlasciciel@firma.pl');
        expect(formData.get('category')).toBeNull();
    });

    it('w trakcie wysylki nie wysyla ponownie i oglasza stan', async () => {
        const onSubmit = jest.fn();
        renderEditor({ onSubmit, isPending: true });

        await userEvent.click(screen.getByRole('button', { name: 'Wysyłam zgłoszenie…' }));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(
            screen.getAllByRole('status').some(node => node.textContent === 'Wysyłam zgłoszenie…'),
        ).toBe(true);
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderEditor({
            fieldErrors: {
                submitterEmail: 'addBusiness.errors.required',
                'hours.monday.close': 'addBusiness.errors.incompleteHours',
                languages: 'addBusiness.errors.languagesRequired',
            },
            error: 'GEOCODE_UNAVAILABLE',
        });

        expect(await axe(container)).toHaveNoViolations();
    });
});
