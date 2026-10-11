/**
 * @jest-environment node
 */
import { sendMail, toHeaderText } from './mailer';

const mockTransportSendMail = jest.fn();

// SMTP (Gmail) to zewnetrzny serwis — zaden test nie wysyla prawdziwego maila.
jest.mock('nodemailer', () => ({
    __esModule: true,
    default: { createTransport: () => ({ sendMail: mockTransportSendMail }) },
}));
jest.mock('../../env', () => ({
    env: { MY_GMAIL: 'operator@example.com', MY_GMAIL_PASSWORD: 'app-password' },
}));

const transportSendMail = mockTransportSendMail;

beforeEach(() => {
    transportSendMail.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('sendMail', () => {
    it('wysyla wiadomosc z konta operatora z replyTo i zalacznikami', async () => {
        transportSendMail.mockResolvedValue({ messageId: '1' });
        const attachment = { filename: 'a.json', content: '{}', contentType: 'application/json' };

        const result = await sendMail({
            to: 'operator@example.com',
            replyTo: 'owner@example.com',
            subject: 'Temat',
            text: 'Tresc',
            attachments: [attachment],
        });

        expect(result).toEqual({ ok: true });
        expect(transportSendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'operator@example.com',
                to: 'operator@example.com',
                replyTo: 'owner@example.com',
                subject: 'Temat',
                text: 'Tresc',
                attachments: [attachment],
            }),
        );
    });

    it('usuwa znaki nowej linii z tematu', async () => {
        transportSendMail.mockResolvedValue({ messageId: '1' });

        await sendMail({ to: 'a@example.com', subject: 'Firma\r\nBcc: x@evil.com', text: 't' });

        expect(transportSendMail.mock.calls[0][0].subject).toBe('Firma Bcc: x@evil.com');
    });

    it('blad transportu zwraca typowany kod bez surowego komunikatu', async () => {
        const smtpError = Object.assign(new Error('550 owner@example.com rejected'), {
            code: 'EENVELOPE',
            responseCode: 550,
        });
        transportSendMail.mockRejectedValue(smtpError);

        const result = await sendMail({ to: 'a@example.com', subject: 's', text: 't' });

        expect(result).toEqual({ ok: false, code: 'SEND_FAILED' });
        expect(JSON.stringify(result)).not.toContain('rejected');
        // Log serwera tez bez komunikatu: odpowiedz SMTP zawiera adres odbiorcy.
        expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
            'owner@example.com',
        );
    });
});

describe('toHeaderText', () => {
    it('zamienia znaki kontrolne i separatory linii na spacje', () => {
        // Kody znakow (NUL, TAB, U+2028, LF) zamiast literalow — bez niewidocznych znakow w pliku.
        const [nul, tab, lineSeparator, lf] = [0, 9, 8232, 10].map(code =>
            String.fromCodePoint(code),
        );

        expect(toHeaderText(`A${nul}B${tab}C${lineSeparator}D${lf}`)).toBe('A B C D');
    });
});
