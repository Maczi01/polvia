import { render, type RenderResult, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import messages from '../../../../../messages/pl.json';
import { ContactFormFromQuery } from './contact-form-from-query';

expect.extend(toHaveNoViolations);

/** Query adresu i router App Routera to granice zewnetrzne komponentu. */
const mockQuery: { params: URLSearchParams } = { params: new URLSearchParams() };

jest.mock('next/navigation', () => ({
    useSearchParams: () => mockQuery.params,
    useRouter: () => ({ push: jest.fn() }),
}));

function renderForm(query: string): RenderResult {
    mockQuery.params = new URLSearchParams(query);
    return render(
        <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
            <ContactFormFromQuery />
        </NextIntlClientProvider>,
    );
}

describe('ContactFormFromQuery', () => {
    it('z profilu firmy: temat Premium i wiadomosc z adresem profilu', async () => {
        const { container } = renderForm('topic=premium&firma=kancelaria-nowak');

        expect(screen.getByRole('textbox', { name: 'Temat' })).toHaveValue('Premium');
        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue(
            'Dzień dobry, chcę włączyć stronę premium dla firmy polvia.pl/firma/kancelaria-nowak. Proszę o dane do przelewu.',
        );
        expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('z cennika (bez firmy): temat Premium i wiadomosc z miejscem na nazwe firmy', () => {
        renderForm('topic=premium');

        expect(screen.getByRole('textbox', { name: 'Temat' })).toHaveValue('Premium');
        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue(
            'Dzień dobry, chcę włączyć stronę premium dla mojej firmy: (nazwa firmy). Proszę o dane do przelewu.',
        );
    });

    it('slug spoza formatu nie trafia do wiadomosci (wiadomosc bez firmy)', () => {
        renderForm('topic=premium&firma=%3Cscript%3E');

        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue(
            'Dzień dobry, chcę włączyć stronę premium dla mojej firmy: (nazwa firmy). Proszę o dane do przelewu.',
        );
    });

    it('bez query: pusty formularz jak dotad', () => {
        renderForm('');

        expect(screen.getByRole('textbox', { name: 'Temat' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue('');
    });
});
