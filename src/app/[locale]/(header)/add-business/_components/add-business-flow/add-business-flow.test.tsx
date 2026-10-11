import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { GenerateDraftResult, SubmitDraftResult } from '@/lib/add-business/types';

import { generateDraftAction, submitDraftAction } from '../../_actions';
import { PIN_FIXTURE, PREVIEW_FIXTURE } from '../business-card-preview/preview-fixture';
import { renderWithIntl } from '../test-utils/render-with-intl';
import { AddBusinessFlow } from './add-business-flow';

expect.extend(toHaveNoViolations);

// Akcje to granica sieci (OpenAI, Redis, maile) — w tescie UI zastepujemy je w calosci.
jest.mock('../../_actions', () => ({
    generateDraftAction: jest.fn(),
    relocateDraftAction: jest.fn(),
    submitDraftAction: jest.fn(),
}));
jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'));

const generate = jest.mocked(generateDraftAction);
const submit = jest.mocked(submitDraftAction);

const READY: GenerateDraftResult = {
    status: 'ready',
    draftId: 'draft-1',
    preview: PREVIEW_FIXTURE,
    unconfirmed: [],
    logoCandidate: null,
    pin: PIN_FIXTURE,
};

beforeEach(() => {
    generate.mockReset();
    submit.mockReset();
});

async function submitLink(url = 'kawiarnia.pl'): Promise<void> {
    await userEvent.type(screen.getByRole('textbox', { name: /Adres strony firmy/ }), url);
    await userEvent.click(screen.getByRole('button', { name: 'Przygotuj wpis' }));
}

describe('<AddBusinessFlow />', () => {
    it('startuje od kroku z linkiem', async () => {
        const { container } = renderWithIntl(<AddBusinessFlow />);

        expect(screen.getByRole('heading', { name: 'Link do firmy' })).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('w trakcie generowania ogłasza etap i blokuje przycisk', async () => {
        // React 19 splata wszystkie trwajace akcje asynchroniczne: niezakonczona obietnica
        // zablokowalaby przejscia w kolejnych testach, wiec konczymy ja na koniec testu.
        let finish: (result: GenerateDraftResult) => void = () => {};
        generate.mockReturnValue(new Promise(resolve => (finish = resolve)));
        renderWithIntl(<AddBusinessFlow />);

        await submitLink();

        expect(await screen.findByText('Czytam stronę…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Przygotowuję…' })).toHaveAttribute(
            'aria-disabled',
            'true',
        );

        finish({ status: 'limited', retryAfter: 60 });
        expect(
            await screen.findByRole('heading', { name: 'Osiągnięto dzienny limit' }),
        ).toBeInTheDocument();
    });

    it('link social przechodzi do trybu recznego z wypelnionym linkiem', async () => {
        generate.mockResolvedValue({
            status: 'needsManual',
            reason: 'SOCIAL_LINK',
            prefill: { link: 'https://instagram.com/kawiarnia' },
        });
        renderWithIntl(<AddBusinessFlow />);

        await submitLink('https://instagram.com/kawiarnia');

        expect(await screen.findByRole('heading', { name: 'Dane firmy' })).toHaveFocus();
        expect(screen.getByRole('textbox', { name: 'Strona www lub profil' })).toHaveValue(
            'https://instagram.com/kawiarnia',
        );
    });

    it('gotowy szkic → edycja → wysylka → podziekowanie', async () => {
        generate.mockResolvedValue(READY);
        const sent: SubmitDraftResult = {
            status: 'sent',
            card: PREVIEW_FIXTURE,
            unconfirmed: [],
            pin: PIN_FIXTURE,
            hasLogo: false,
        };
        submit.mockResolvedValue(sent);
        renderWithIntl(<AddBusinessFlow />);

        await submitLink();
        expect(
            await screen.findByRole('heading', { name: 'Sprawdź i popraw wpis' }),
        ).toBeInTheDocument();

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Twój e-mail (wymagane)' }),
            'wlasciciel@firma.pl',
        );
        await userEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

        expect(
            await screen.findByRole('heading', { name: 'Dziękujemy za zgłoszenie!' }),
        ).toBeInTheDocument();
        expect(submit.mock.calls[0][1].get('draftId')).toBe('draft-1');
    });

    it('odrzucenie wysylki zostawia edytor z wpisanymi danymi i bledem pola', async () => {
        generate.mockResolvedValue(READY);
        submit.mockResolvedValue({
            status: 'invalid',
            fieldErrors: { submitterEmail: 'addBusiness.errors.invalidEmail' },
        });
        renderWithIntl(<AddBusinessFlow />);

        await submitLink();
        const email = await screen.findByRole('textbox', { name: 'Twój e-mail (wymagane)' });
        await userEvent.type(email, 'zly-adres');
        await userEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

        // Pole istnieje przez caly czas — czekamy na wynik akcji, nie na samo pole.
        expect(await screen.findByText('Wpisz poprawny adres e-mail.')).toBeInTheDocument();
        const invalid = screen.getByRole('textbox', { name: 'Twój e-mail (wymagane)' });
        expect(invalid).toHaveValue('zly-adres');
        expect(invalid).toHaveAccessibleDescription(/Wpisz poprawny adres e-mail\./);
    });

    it('wygasly szkic wraca do linku z komunikatem', async () => {
        generate.mockResolvedValue(READY);
        submit.mockResolvedValue({
            status: 'error',
            error: { code: 'DRAFT_EXPIRED', message: 'techniczny' },
        });
        renderWithIntl(<AddBusinessFlow />);

        await submitLink();
        await screen.findByRole('heading', { name: 'Sprawdź i popraw wpis' });
        await userEvent.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Propozycja wpisu wygasła');
        expect(screen.getByRole('heading', { name: 'Link do firmy' })).toBeInTheDocument();
        expect(screen.queryByText('techniczny')).not.toBeInTheDocument();
    });

    it('duplikat linkuje do istniejacego wpisu', async () => {
        generate.mockResolvedValue({
            status: 'duplicate',
            name: 'Kawiarnia Lwów',
            slug: 'kawiarnia-lwow',
            url: '/mapa?place=kawiarnia-lwow',
        });
        renderWithIntl(<AddBusinessFlow />);

        await submitLink();

        expect(
            await screen.findByRole('link', { name: 'Zobacz wpis firmy Kawiarnia Lwów' }),
        ).toHaveAttribute('href', '/map?place=kawiarnia-lwow');
    });

    it('limit pokazuje czas ponowienia i link do kontaktu', async () => {
        generate.mockResolvedValue({ status: 'limited', retryAfter: 3 * 60 * 60 });
        renderWithIntl(<AddBusinessFlow />);

        await submitLink();

        expect(await screen.findByText(/Spróbuj ponownie za 3 godziny\./)).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Napisz do nas przez formularz kontaktowy' }),
        ).toHaveAttribute('href', '/contact');
    });

    it('awaria polaczenia z akcja daje komunikat zamiast wywrotki strony', async () => {
        generate.mockRejectedValue(new Error('Failed to fetch'));
        renderWithIntl(<AddBusinessFlow />);

        await submitLink();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Coś poszło nie tak po naszej stronie.',
        );
    });
});
