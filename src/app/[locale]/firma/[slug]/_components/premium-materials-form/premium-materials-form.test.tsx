import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { MaterialsState } from '@/lib/premium-checkout-fields';

import { renderWithIntl } from '../profile-test-utils';
import { PremiumMaterialsForm } from './premium-materials-form';

expect.extend(toHaveNoViolations);

const SESSION_ID = 'cs_test_a1B2c3';
const SLUG = 'mistrz-remontu';

type Action = jest.Mock<Promise<MaterialsState>, [MaterialsState, FormData]>;

function mockAction(implementation: () => Promise<MaterialsState>): Action {
    return jest.fn<Promise<MaterialsState>, [MaterialsState, FormData]>(implementation);
}

function renderForm(action: Action) {
    return renderWithIntl(
        <PremiumMaterialsForm sessionId={SESSION_ID} slug={SLUG} action={action} />,
    );
}

const priceList = () => screen.getByRole('textbox', { name: /Cennik usług/ });
const submit = () => screen.getByRole('button', { name: 'Wyślij materiały' });

describe('PremiumMaterialsForm', () => {
    it('ma szablony, pola tekstowe z limitem i podpowiedzia, i przechodzi jest-axe', async () => {
        const { container } = renderForm(mockAction(async () => null));

        expect(screen.getByRole('group', { name: 'Szablon strony' })).toBeInTheDocument();
        expect(screen.getAllByRole('radio')).toHaveLength(3);
        expect(priceList()).toHaveAttribute('maxLength', '4000');
        expect(priceList()).toHaveAccessibleDescription(/Jedna usługa w linii/);
        expect(await axe(container)).toHaveNoViolations();
    });

    it('wysyla sesje, slug, szablon i tresc; po sukcesie ogłasza wynik i chowa formularz', async () => {
        const action = mockAction(async () => ({ data: { sent: true } }));
        const { container } = renderForm(action);

        await userEvent.click(screen.getByRole('radio', { name: /Profesjonalny/ }));
        await userEvent.type(priceList(), 'Wymiana zamka — od 150 zł');
        await userEvent.click(submit());

        expect(
            await screen.findByText('Dziękujemy! Materiały dotarły — odezwiemy się mailem.'),
        ).toBeInTheDocument();
        const formData = action.mock.calls[0][1];
        expect(formData.get('sessionId')).toBe(SESSION_ID);
        expect(formData.get('slug')).toBe(SLUG);
        expect(formData.get('template')).toBe('professional');
        expect(formData.get('priceList')).toBe('Wymiana zamka — od 150 zł');
        expect(screen.queryByRole('button', { name: 'Wyślij materiały' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bledy walidacji z akcji podpina przez aria-describedby i zachowuje wpisany tekst', async () => {
        // React 19 splata trwajace akcje: obietnica musi sie zakonczyc przed koncem testu.
        let finish: (state: MaterialsState) => void = () => {};
        const action = mockAction(() => new Promise(resolve => (finish = resolve)));
        const { container } = renderForm(action);

        await userEvent.type(priceList(), 'Cennik');
        await userEvent.click(submit());
        expect(await screen.findByRole('button', { name: 'Wysyłam…' })).toHaveAttribute(
            'aria-disabled',
            'true',
        );

        finish({
            error: {
                code: 'BAD_INPUT',
                message: 'Popraw zaznaczone pola.',
                fields: {
                    template: 'Wybierz szablon strony.',
                    priceList: 'Maksymalnie 4000 znaków.',
                },
            },
        });

        expect(await screen.findByText('Popraw zaznaczone pola.')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Szablon strony' })).toHaveAccessibleDescription(
            'Wybierz szablon strony.',
        );
        expect(priceList()).toHaveAccessibleDescription(/Maksymalnie 4000 znaków\./);
        expect(priceList()).toHaveAttribute('aria-invalid', 'true');
        expect(priceList()).toHaveValue('Cennik');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('blad serwera (np. FORBIDDEN) pokazuje komunikat z akcji, bez surowych szczegolow', async () => {
        const action = mockAction(async () => ({
            error: {
                code: 'FORBIDDEN',
                message: 'Nie możemy potwierdzić płatności dla tej firmy.',
            },
        }));
        renderForm(action);

        await userEvent.click(screen.getByRole('radio', { name: /Galeria/ }));
        await userEvent.click(submit());

        expect(
            await screen.findByText('Nie możemy potwierdzić płatności dla tej firmy.'),
        ).toBeInTheDocument();
        expect(submit()).toBeInTheDocument();
    });

    it('materialy tej sesji juz wyslane: od razu potwierdzenie, bez formularza', async () => {
        const action = mockAction(async () => null);
        const { container } = renderWithIntl(
            <PremiumMaterialsForm sessionId={SESSION_ID} slug={SLUG} action={action} isAlreadySent />,
        );

        expect(
            screen.getByText('Dziękujemy! Materiały dotarły — odezwiemy się mailem.'),
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Wyślij materiały' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(action).not.toHaveBeenCalled();
        expect(await axe(container)).toHaveNoViolations();
    });
});
