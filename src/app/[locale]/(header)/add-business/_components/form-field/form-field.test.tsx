import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../test-utils/render-with-intl';
import { TextAreaField, TextField } from './form-field';

expect.extend(toHaveNoViolations);

describe('<TextField />', () => {
    it('podpina podpowiedz i blad pod kontrolke przez aria-describedby', () => {
        renderWithIntl(
            <TextField
                name="email"
                label="E-mail firmy"
                hint="Widoczny w katalogu."
                error="addBusiness.errors.invalidEmail"
            />,
        );

        const input = screen.getByRole('textbox', { name: 'E-mail firmy' });
        expect(input).toHaveAccessibleDescription(
            'Widoczny w katalogu. Wpisz poprawny adres e-mail.',
        );
        expect(input).toBeInvalid();
    });

    it('bez bledu nie ma aria-describedby ani aria-invalid', () => {
        renderWithIntl(<TextField name="city" label="Miasto" />);

        const input = screen.getByRole('textbox', { name: 'Miasto' });
        expect(input).not.toHaveAttribute('aria-describedby');
        expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('pole wymagane ma dopisek w etykiecie i aria-required', () => {
        renderWithIntl(<TextField name="name" label="Nazwa firmy" isRequired />);

        expect(screen.getByRole('textbox', { name: 'Nazwa firmy (wymagane)' })).toBeRequired();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderWithIntl(
            <>
                <TextField name="name" label="Nazwa firmy" error="addBusiness.errors.required" />
                <TextAreaField name="notes" label="Uwagi" hint="Opcjonalnie." />
            </>,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
