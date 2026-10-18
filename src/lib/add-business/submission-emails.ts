import 'server-only';

import { createTranslator } from 'next-intl';

import type { Locale } from '@/i18n/config';
import { operatorText } from '@/lib/add-business/operator-email-text';
import {
    bulletList,
    formatAddress,
    formatHours,
    line,
    type SubmissionEmailInput,
} from '@/lib/add-business/submission-email-format';
import { isServiceLanguage } from '@/lib/languages';
import { getOperatorInbox, type MailMessage, toHeaderText } from '@/lib/mailer';

import en from '../../../messages/en.json';
import pl from '../../../messages/pl.json';
import ru from '../../../messages/ru.json';
import uk from '../../../messages/uk.json';

/** Reeksport — wolajacy (`submit-draft`) i testy biora typy wejscia stad. */
export type {
    BuiltServiceEntry,
    SubmissionEmailInput,
} from '@/lib/add-business/submission-email-format';

/**
 * Tresc obu maili po wysylce zgloszenia (R13, R15). Funkcje sa czyste: zwracaja
 * `MailMessage`, a wysyla je wolajacy przez `sendMail` z `@/lib/mailer`.
 *
 * Semantyka bledow nalezy do wolajacego (U8):
 * - `sendMail(buildOperatorEmail(input))` z `ok: false` = blad submitu `SEND_FAILED`;
 *   szkic jest juz skonsumowany, wiec `entry.json` trzeba zalogowac w calosci;
 * - `sendMail(buildOwnerConfirmationEmail(input))` z `ok: false` = tylko log, sukces zostaje.
 *
 * Tlumaczenia potwierdzenia czytamy z `messages/*.json` przez `createTranslator` — te same
 * pliki co `src/i18n/request.ts`, ale bez zaleznosci od kontekstu requestu next-intl.
 */

const MESSAGES = { pl, en, ru, uk } satisfies Record<Locale, unknown>;

export function buildOperatorEmail(input: SubmissionEmailInput): MailMessage {
    const { entry, submitterEmail, logo } = input;
    const attachments: NonNullable<MailMessage['attachments']> = [
        {
            filename: `${entry.slug}.json`,
            content: JSON.stringify(entry.json, null, 4),
            contentType: 'application/json',
        },
        ...(logo === null
            ? []
            : [{ filename: `${entry.slug}.png`, content: logo, contentType: 'image/png' }]),
    ];

    return {
        to: getOperatorInbox(),
        replyTo: submitterEmail,
        // `sendMail` i tak czysci naglowek; tu, zeby wiadomosc byla poprawna sama w sobie.
        subject: toHeaderText(`[Polvia] Zgłoszenie: ${entry.json.name}`),
        text: operatorText(input),
        attachments,
    };
}

function confirmationTranslator(locale: Locale) {
    return createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'addBusiness.confirmationEmail',
    });
}

export function buildOwnerConfirmationEmail(input: SubmissionEmailInput): MailMessage {
    const { entry, stored, submitterEmail } = input;
    const t = confirmationTranslator(stored.locale);
    const { json } = entry;
    const [location] = json.locations;
    const name = json.name;

    const hours = formatHours(location?.openingHours, day => t(`days.${day}`));
    const languages = (json.languages ?? []).map(code =>
        isServiceLanguage(code) ? t(`languages.${code}`) : code,
    );
    const facts = [
        line(t('fields.name'), name),
        line(t('fields.address'), formatAddress(location)),
        ...(location?.phoneNumber ? [line(t('fields.phone'), location.phoneNumber)] : []),
        ...(location?.email ? [line(t('fields.email'), location.email)] : []),
        ...(location?.webpage ? [line(t('fields.webpage'), location.webpage)] : []),
        ...(hours.length > 0 ? [`${t('fields.openingHours')}:`, ...bulletList(hours)] : []),
        ...(languages.length > 0 ? [line(t('fields.languages'), languages.join(', '))] : []),
    ];

    return {
        to: submitterEmail,
        subject: toHeaderText(t('subject', { name })),
        text: [
            `${t('greeting')}\n${t('intro', { name })}`,
            [t('factsHeading'), ...facts].join('\n'),
            t('review'),
            t('correction'),
            t('signature'),
        ].join('\n\n'),
    };
}
