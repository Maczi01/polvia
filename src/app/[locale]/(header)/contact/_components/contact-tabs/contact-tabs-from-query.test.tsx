import { render, type RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import messages from '../../../../../../../messages/pl.json';
import { ContactTabsFromQuery } from './contact-tabs-from-query';

expect.extend(toHaveNoViolations);

/** Query adresu i router App Routera to granice zewnetrzne komponentu. */
const mockQuery: { params: URLSearchParams } = { params: new URLSearchParams() };

jest.mock('next/navigation', () => ({
    useSearchParams: () => mockQuery.params,
    useRouter: () => ({ push: jest.fn() }),
}));

const PREMIUM_NO_SERVICE =
    'Dzień dobry, chcę włączyć stronę premium dla mojej firmy: (nazwa firmy). Proszę o dane do przelewu.';

function renderTabs(query: string): RenderResult {
    mockQuery.params = new URLSearchParams(query);
    return render(
        <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
            <ContactTabsFromQuery business={<p>Panel firmy</p>} />
        </NextIntlClientProvider>,
    );
}

describe('ContactTabsFromQuery', () => {
    it('bez query otwiera zakladke „Mam firmę” z panelem firmy', async () => {
        const { container } = renderTabs('');

        expect(screen.getByRole('tab', { name: 'Mam firmę' })).toHaveAttribute(
            'aria-selected',
            'true',
        );
        expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel firmy');
        expect(screen.queryByRole('textbox', { name: 'Temat' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('klikniecie „Mam pytanie” pokazuje pusty formularz', async () => {
        const user = userEvent.setup();
        renderTabs('');

        await user.click(screen.getByRole('tab', { name: 'Mam pytanie' }));

        expect(screen.getByRole('textbox', { name: 'Temat' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue('');
        expect(screen.queryByText('Panel firmy')).not.toBeInTheDocument();
    });

    it('?tab=pytanie otwiera formularz od razu', () => {
        renderTabs('tab=pytanie');

        expect(screen.getByRole('tab', { name: 'Mam pytanie' })).toHaveAttribute(
            'aria-selected',
            'true',
        );
        expect(screen.getByRole('textbox', { name: 'Temat' })).toHaveValue('');
    });

    it('z profilu firmy: formularz z tematem Premium i adresem profilu', async () => {
        const { container } = renderTabs('topic=premium&firma=kancelaria-nowak');

        expect(screen.getByRole('textbox', { name: 'Temat' })).toHaveValue('Premium');
        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue(
            'Dzień dobry, chcę włączyć stronę premium dla firmy polvia.pl/firma/kancelaria-nowak. Proszę o dane do przelewu.',
        );
        expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('z cennika (bez firmy): wiadomosc z miejscem na nazwe firmy', () => {
        renderTabs('topic=premium');

        expect(screen.getByRole('textbox', { name: 'Temat' })).toHaveValue('Premium');
        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue(
            PREMIUM_NO_SERVICE,
        );
    });

    it('slug spoza formatu nie trafia do wiadomosci (wiadomosc bez firmy)', () => {
        renderTabs('topic=premium&firma=%3Cscript%3E');

        expect(screen.getByRole('textbox', { name: 'Twoja wiadomość' })).toHaveValue(
            PREMIUM_NO_SERVICE,
        );
    });
});
