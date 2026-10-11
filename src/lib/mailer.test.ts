/**
 * @jest-environment node
 */
import { sendMail, SMTP_TIMEOUT_MS, toHeaderText } from './mailer';

const mockTransportSendMail = jest.fn();
const mockCreateTransport = jest.fn();

// SMTP (Gmail) to zewnetrzny serwis — zaden test nie wysyla prawdziwego maila.
jest.mock('nodemailer', () => ({
    __esModule: true,
    default: {
        createTransport: (options: unknown) => {
            mockCreateTransport(options);
            return { sendMail: mockTransportSendMail };
        },
    },
}));
jest.mock('../../env', () => ({
    env: { MY_GMAIL: 'operator@example.com', MY_GMAIL_PASSWORD: 'app-password' },
}));

const transportSendMail = mockTransportSendMail;

beforeEach(() => {
    transportSendMail.mockReset();
    mockCreateTransport.mockReset();
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

    it('transport ma timeouty polaczenia, powitania i gniazda — zawieszony SMTP konczy sie bledem', async () => {
        transportSendMail.mockResolvedValue({ messageId: '1' });

        await sendMail({ to: 'a@example.com', subject: 's', text: 't' });

        expect(mockCreateTransport).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionTimeout: SMTP_TIMEOUT_MS,
                greetingTimeout: SMTP_TIMEOUT_MS,
                socketTimeout: SMTP_TIMEOUT_MS,
            }),
        );
        expect(SMTP_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
    });

    it('timeout transportu to SEND_FAILED, nie wyjatek', async () => {
        transportSendMail.mockRejectedValue(
            Object.assign(new Error('Greeting never received'), { code: 'ETIMEDOUT' }),
        );

        expect(await sendMail({ to: 'a@example.com', subject: 's', text: 't' })).toEqual({
            ok: false,
            code: 'SEND_FAILED',
        });
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
