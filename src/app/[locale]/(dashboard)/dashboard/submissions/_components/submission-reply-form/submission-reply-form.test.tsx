import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { sendSubmissionReply } from '../../_actions';
import { SubmissionReplyForm } from './submission-reply-form';

expect.extend(toHaveNoViolations);

const ID = '5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e';
const TO = 'wlasciciel@nowak.pl';
const SUBJECT = 'Firma jest w katalogu';
const TEXT = 'Dzień dobry, wpis: https://www.polvia.pl/firma/nowak';

jest.mock('../../_actions', () => ({ sendSubmissionReply: jest.fn() }));

const mockSend = jest.mocked(sendSubmissionReply);

function renderForm(initialText = TEXT, hasPremiumConsent = false) {
    return render(
        <SubmissionReplyForm
            id={ID}
            to={TO}
            locale="pl"
            hasPremiumConsent={hasPremiumConsent}
            initialSubject={SUBJECT}
            initialText={initialText}
        />,
    );
}

const sendButton = () => screen.getByRole('button', { name: 'Send email' });

beforeEach(() => {
    mockSend.mockReset();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('SubmissionReplyForm', () => {
    it('pokazuje wypelniony tekst i wysyla go po potwierdzeniu, bez naruszen a11y', async () => {
        mockSend.mockResolvedValue({ data: { id: ID } });
        const { container } = renderForm();

        expect(screen.getByLabelText('Subject')).toHaveValue(SUBJECT);
        expect(screen.getByLabelText('Message')).toHaveValue(TEXT);
        expect(await axe(container)).toHaveNoViolations();

        await userEvent.click(sendButton());

        expect(mockSend).toHaveBeenCalledWith(ID, SUBJECT, TEXT);
        expect(await screen.findByText(`Sent to ${TO}.`)).toBeInTheDocument();
        expect(sendButton()).toBeDisabled();
    });

    it('wysyla tekst po edycji, a edycja odblokowuje ponowna wysylke', async () => {
        mockSend.mockResolvedValue({ data: { id: ID } });
        renderForm();

        await userEvent.type(screen.getByLabelText('Message'), ' Pozdrawiam');
        await userEvent.click(sendButton());
        await screen.findByText(`Sent to ${TO}.`);

        expect(mockSend).toHaveBeenCalledWith(ID, SUBJECT, `${TEXT} Pozdrawiam`);

        await userEvent.type(screen.getByLabelText('Message'), '!');

        expect(sendButton()).toBeEnabled();
        expect(screen.queryByText(`Sent to ${TO}.`)).not.toBeInTheDocument();
    });

    it.each([
        [true, 'The submitter agreed to premium information'],
        [false, 'No consent to premium information'],
    ])('zgoda na premium %s: operator widzi jej stan', (hasConsent, message) => {
        renderForm(TEXT, hasConsent);

        expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    });

    it('anulowanie potwierdzenia niczego nie wysyla', async () => {
        jest.mocked(window.confirm).mockReturnValue(false);
        renderForm();

        await userEvent.click(sendButton());

        expect(mockSend).not.toHaveBeenCalled();
    });

    it('znacznik linku blokuje wysylke, dopoki nie zostanie zastapiony', async () => {
        renderForm('Wpis: [LINK]');

        expect(sendButton()).toBeDisabled();
        expect(screen.getByText(/Replace \[LINK\]/)).toBeInTheDocument();

        const message = screen.getByLabelText('Message');
        await userEvent.clear(message);
        await userEvent.type(message, 'Wpis: https://www.polvia.pl/firma/nowak');

        expect(sendButton()).toBeEnabled();
    });

    it('pusta tresc blokuje wysylke', async () => {
        renderForm();

        await userEvent.clear(screen.getByLabelText('Message'));

        expect(sendButton()).toBeDisabled();
    });

    it('blad akcji pokazuje powod i pozwala sprobowac ponownie', async () => {
        mockSend.mockResolvedValue({
            error: { code: 'SEND_FAILED', message: 'Could not send the email. Try again.' },
        });
        renderForm();

        await userEvent.click(sendButton());

        expect(await screen.findByText('Could not send the email. Try again.')).toBeInTheDocument();
        expect(sendButton()).toBeEnabled();
    });

    it('odrzucona akcja pokazuje komunikat zamiast wywracac strone', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockSend.mockRejectedValue(new TypeError('Failed to fetch'));
        renderForm();

        await userEvent.click(sendButton());

        expect(await screen.findByText('Could not reach the server. Try again.')).toBeInTheDocument();
    });
});
