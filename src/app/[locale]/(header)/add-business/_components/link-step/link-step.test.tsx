import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../test-utils/render-with-intl';
import { checkLink, LinkStep } from './link-step';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));

function renderStep(overrides: Partial<Parameters<typeof LinkStep>[0]> = {}) {
    const onGenerate = jest.fn();
    const onManual = jest.fn();
    const result = renderWithIntl(
        <LinkStep
            fieldErrors={{}}
            error={null}
            isPending={false}
            onGenerate={onGenerate}
            onManual={onManual}
            {...overrides}
        />,
    );
    return { ...result, onGenerate, onManual };
}

const urlInput = () => screen.getByRole('textbox', { name: 'Adres strony firmy (wymagane)' });
const submit = () => screen.getByRole('button', { name: 'Przygotuj wpis' });

describe('<LinkStep />', () => {
    it('pusty link daje komunikat bledu bez wywolania akcji', async () => {
        const { onGenerate } = renderStep();

        await userEvent.click(submit());

        expect(onGenerate).not.toHaveBeenCalled();
        expect(urlInput()).toHaveAccessibleDescription(/To pole jest wymagane\./);
    });

    it('niepoprawny link daje komunikat bledu bez wywolania akcji', async () => {
        const { onGenerate } = renderStep();

        await userEvent.type(urlInput(), 'ftp://firma.pl');
        await userEvent.click(submit());

        expect(onGenerate).not.toHaveBeenCalled();
        expect(urlInput()).toHaveAccessibleDescription(/Wpisz poprawny adres strony/);
    });

    it('poprawny link wysyla tryb link z uzupelnionym schematem', async () => {
        const { onGenerate } = renderStep();

        await userEvent.type(urlInput(), 'kawiarnia.pl');
        await userEvent.click(submit());

        expect(onGenerate).toHaveBeenCalledTimes(1);
        const formData: FormData = onGenerate.mock.calls[0][0];
        expect(formData.get('mode')).toBe('link');
        expect(formData.get('url')).toBe('https://kawiarnia.pl');
    });

    it('w trakcie generowania blokuje ponowne wyslanie i oglasza etap', async () => {
        const { onGenerate } = renderStep({ isPending: true });

        expect(screen.getByRole('button', { name: 'Przygotowuję…' })).toHaveAttribute(
            'aria-disabled',
            'true',
        );
        expect(screen.getByRole('status')).toHaveTextContent('Czytam stronę…');

        await userEvent.click(screen.getByRole('button', { name: 'Przygotowuję…' }));
        expect(onGenerate).not.toHaveBeenCalled();
    });

    it('pokazuje blad pola z serwera i blad akcji', () => {
        renderStep({
            fieldErrors: { url: 'addBusiness.errors.invalidUrl' },
            error: 'GENERATION_FAILED',
        });

        expect(urlInput()).toBeInvalid();
        expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się przygotować wpisu.');
    });

    it('przycisk trybu recznego przelacza krok', async () => {
        const { onManual } = renderStep();

        await userEvent.click(screen.getByRole('button', { name: 'Wpisz dane ręcznie' }));

        expect(onManual).toHaveBeenCalledTimes(1);
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderStep({ fieldErrors: { url: 'addBusiness.errors.required' } });

        expect(await axe(container)).toHaveNoViolations();
    });
});

describe('checkLink', () => {
    it.each([
        ['https://firma.pl/kontakt', 'https://firma.pl/kontakt'],
        ['  www.firma.pl ', 'https://www.firma.pl'],
        ['http://firma.pl', 'http://firma.pl'],
    ])('akceptuje %s', (raw, url) => {
        expect(checkLink(raw)).toEqual({ ok: true, url });
    });

    it.each(['mailto:a@b.pl', 'javascript:alert(1)', 'https://localhost', 'nie link'])(
        'odrzuca %s',
        raw => {
            expect(checkLink(raw)).toEqual({ ok: false, error: 'addBusiness.errors.invalidUrl' });
        },
    );
});
