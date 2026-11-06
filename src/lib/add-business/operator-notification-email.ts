import 'server-only';

import { line, type SubmissionEmailInput } from '@/lib/add-business/submission-email-format';
import { getOperatorInbox, type MailMessage, toHeaderText } from '@/lib/mailer';

import { env } from '../../../env';

/**
 * Krotkie powiadomienie o zgloszeniu zapisanym w bazie: sygnal i link do panelu, bez
 * zalacznikow. Pelna tresc (JSON, logo) czeka w panelu; `buildOperatorEmail` zostaje
 * na wypadek nieudanego zapisu.
 */
export function buildOperatorNotificationEmail(
    input: SubmissionEmailInput,
    submissionId: string,
): MailMessage {
    const { entry, submitterEmail, logo } = input;
    const { json } = entry;
    const [location] = json.locations;

    return {
        to: getOperatorInbox(),
        replyTo: submitterEmail,
        subject: toHeaderText(`[Polvia] Zgłoszenie: ${json.name}`),
        text: [
            `Nowe zgłoszenie firmy: ${json.name}`,
            '',
            line('Kategoria', json.category),
            line('Miasto', location?.city),
            line('Logo', logo === null ? null : 'tak'),
            '',
            `Szczegóły: ${env.NEXT_PUBLIC_SITE_URL}/dashboard/submissions/${submissionId}`,
        ].join('\n'),
    };
}
