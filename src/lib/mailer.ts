import 'server-only';

import nodemailer from 'nodemailer';

import { env } from '../../env';

/**
 * Jedyny kanal wysylki maili aplikacji: konto Gmail z `env.MY_GMAIL` (nadawca).
 *
 * `sendMail` nie rzuca. Blad transportu wraca jako `{ ok: false, code: 'SEND_FAILED' }`,
 * a surowy blad nodemailera trafia wylacznie do logu serwera — i to bez `message`, bo
 * odpowiedz SMTP potrafi zawierac adres odbiorcy (dane osobowe). Wolajacy decyduje, co
 * blad znaczy dla jego operacji (np. mail operatora = blad submitu, potwierdzenie = tylko log).
 */

export interface MailAttachment {
    filename: string;
    content: Buffer | string;
    contentType: string;
}

export interface MailMessage {
    to: string;
    /** Adres, pod ktory trafi odpowiedz (np. e-mail zglaszajacego w mailu do operatora). */
    replyTo?: string;
    subject: string;
    /** Plain text — aplikacja nie wysyla HTML-a. */
    text: string;
    attachments?: MailAttachment[];
}

export type SendMailErrorCode = 'SEND_FAILED';

export type SendMailResult = { ok: true } | { ok: false; code: SendMailErrorCode };

/** Skrzynka operatora katalogu — ta sama, z ktorej wychodza maile. */
export function getOperatorInbox(): string {
    return env.MY_GMAIL;
}

/**
 * Tekst do naglowka (temat): znaki kontrolne i separatory linii zamienione na spacje.
 * Nazwa firmy pochodzi od uzytkownika, a `\r\n` w temacie to klasyczny header injection.
 */
export function toHeaderText(value: string): string {
    // Cc = znaki kontrolne (C0 i C1), Zl/Zp = separatory linii i akapitu Unicode.
    return value.replaceAll(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim();
}

interface TransportErrorDetails {
    name: string;
    code: string | null;
    responseCode: number | null;
}

function describeTransportError(error: unknown): TransportErrorDetails {
    if (!(error instanceof Error)) return { name: typeof error, code: null, responseCode: null };
    const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
    const responseCode =
        'responseCode' in error && typeof error.responseCode === 'number'
            ? error.responseCode
            : null;
    return { name: error.name, code, responseCode };
}

/**
 * Limit kazdej fazy SMTP: nawiazania polaczenia, powitania serwera i bezczynnosci gniazda.
 * Domyslne nodemailera to 2 min / 30 s / 10 min — zawieszony Gmail przezylby `maxDuration`
 * akcji i zgloszenie zniknelo bez logu. Z limitem transport rzuca, a `sendMail` zwraca
 * `SEND_FAILED`, ktory wolajacy loguje.
 */
export const SMTP_TIMEOUT_MS = 10_000;

export async function sendMail(message: MailMessage): Promise<SendMailResult> {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: env.MY_GMAIL, pass: env.MY_GMAIL_PASSWORD },
        connectionTimeout: SMTP_TIMEOUT_MS,
        greetingTimeout: SMTP_TIMEOUT_MS,
        socketTimeout: SMTP_TIMEOUT_MS,
    });

    try {
        await transporter.sendMail({
            from: env.MY_GMAIL,
            to: message.to,
            replyTo: message.replyTo,
            subject: toHeaderText(message.subject),
            text: message.text,
            attachments: message.attachments,
        });
        return { ok: true };
    } catch (error) {
        console.error('mailer: send failed', describeTransportError(error));
        return { ok: false, code: 'SEND_FAILED' };
    }
}
