import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../test-utils/render-with-intl';
import { ManualStep } from './manual-step';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));

function renderStep(overrides: Partial<Parameters<typeof ManualStep>[0]> = {}) {
    const onGenerate = jest.fn();
    const onBack = jest.fn();
    const result = renderWithIntl(
        <ManualStep
            reason={null}
            prefillLink={null}
            fieldErrors={{}}
            error={null}
            isPending={false}
            onGenerate={onGenerate}
            onBack={onBack}
            {...overrides}
        />,
    );
    return { ...result, onGenerate, onBack };
}

describe('<ManualStep />', () => {
    it('po linku social wyjasnia powod i zachowuje link', () => {
        renderStep({ reason: 'SOCIAL_LINK', prefillLink: 'https://instagram.com/kawiarnia' });

        const heading = screen.getByRole('heading', { name: 'Dane firmy' });
        expect(heading).toHaveFocus();
        expect(heading).toHaveAccessibleDescription(/Profili w mediach społecznościowych/);
        expect(screen.getByRole('textbox', { name: 'Strona www lub profil' })).toHaveValue(
            'https://instagram.com/kawiarnia',
        );
    });

    it('wysyla tryb reczny z wpisanymi polami', async () => {
        const { onGenerate } = renderStep();

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Nazwa firmy (wymagane)' }),
            'Kawiarnia Lwów',
        );
        await userEvent.type(screen.getByRole('textbox', { name: 'Miasto (wymagane)' }), 'Gdańsk');
        await userEvent.type(
            screen.getByRole('textbox', { name: 'Opis działalności (wymagane)' }),
            'Kawiarnia z ukraińskimi wypiekami.',
        );
        await userEvent.click(screen.getByRole('button', { name: 'Przygotuj wpis' }));

        const formData: FormData = onGenerate.mock.calls[0][0];
        expect(formData.get('mode')).toBe('manual');
        expect(formData.get('name')).toBe('Kawiarnia Lwów');
        expect(formData.get('city')).toBe('Gdańsk');
        expect(screen.getByText('34 / 1000 znaków')).toBeInTheDocument();
    });

    it('blad walidacji z serwera jest podpiety pod pole opisu', () => {
        renderStep({ fieldErrors: { description: 'addBusiness.errors.tooShort' } });

        expect(
            screen.getByRole('textbox', { name: 'Opis działalności (wymagane)' }),
        ).toHaveAccessibleDescription(/Opis jest za krótki/);
    });

    it('w trakcie generowania nie wysyla ponownie', async () => {
        const { onGenerate } = renderStep({ isPending: true });

        await userEvent.click(screen.getByRole('button', { name: 'Przygotowuję…' }));

        expect(onGenerate).not.toHaveBeenCalled();
        expect(screen.getByRole('status')).toHaveTextContent('Klasyfikuję firmę…');
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderStep({
            reason: 'UNREADABLE',
            fieldErrors: { name: 'addBusiness.errors.required' },
            error: 'GENERATION_FAILED',
        });

        expect(await axe(container)).toHaveNoViolations();
    });
});
