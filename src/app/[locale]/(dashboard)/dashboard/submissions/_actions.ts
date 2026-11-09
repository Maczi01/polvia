'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { hasDashboardAccess } from '@/lib/dashboard-access';
import { sendMail } from '@/lib/mailer';
import {
    isSubmissionPublishingEnabled,
    publishServiceSubmission,
    type PublishedSubmission,
    type PublishErrorCode,
} from '@/lib/publish-submission';
import {
    deleteServiceSubmission,
    getServiceSubmission,
    markServiceSubmissionReplySent,
    setServiceSubmissionStatus,
} from '@/lib/service-submissions';
import {
    REPLY_LINK_PLACEHOLDER,
    REPLY_SUBJECT_MAX_LENGTH,
    REPLY_TEXT_MAX_LENGTH,
} from '@/lib/submission-reply-limits';
import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/lib/submission-status';

type ActionErrorCode = 'FORBIDDEN' | 'BAD_INPUT' | 'NOT_FOUND' | 'SAVE_FAILED';

export type UpdateSubmissionStatusResult =
    | { data: { status: SubmissionStatus }; error?: undefined }
    | { data?: undefined; error: { code: ActionErrorCode; message: string } };

export type DeleteSubmissionResult =
    | { data: { id: string }; error?: undefined }
    | { data?: undefined; error: { code: ActionErrorCode; message: string } };

export type PublishSubmissionResult =
    | { data: PublishedSubmission; error?: undefined }
    | {
          data?: undefined;
          error: { code: ActionErrorCode | PublishErrorCode | 'LOCAL_ONLY'; message: string };
      };

export type SendSubmissionReplyResult =
    /** `sentAt: null` = mail poszedl, ale data sie nie zapisala. */
    | { data: { id: string; sentAt: string | null }; error?: undefined }
    | {
          data?: undefined;
          error: {
              code: ActionErrorCode | 'NOT_PUBLISHED' | 'ALREADY_SENT' | 'SEND_FAILED';
              message: string;
          };
      };

const idSchema = z.string().uuid();

const replySchema = z.object({
    id: idSchema,
    subject: z.string().trim().min(1).max(REPLY_SUBJECT_MAX_LENGTH),
    text: z
        .string()
        .trim()
        .min(1)
        .max(REPLY_TEXT_MAX_LENGTH)
        .refine(text => !text.includes(REPLY_LINK_PLACEHOLDER)),
});

const inputSchema = z.object({
    id: idSchema,
    status: z.enum(SUBMISSION_STATUSES),
});

const SEND_FAILED_MESSAGE = 'Could not send the email. Try again.';

const failure = (code: ActionErrorCode, message: string) => ({ error: { code, message } });

/** Publiczny endpoint POST jak kazda akcja: dostep sprawdza sama (`dashboard-access.ts`). */
export async function updateSubmissionStatus(
    id: string,
    status: string,
): Promise<UpdateSubmissionStatusResult> {
    if (!(await hasDashboardAccess())) return failure('FORBIDDEN', 'Access denied');

    const input = inputSchema.safeParse({ id, status });
    if (!input.success) return failure('BAD_INPUT', 'Invalid submission or status');

    try {
        const isUpdated = await setServiceSubmissionStatus(input.data.id, input.data.status);
        if (!isUpdated) return failure('NOT_FOUND', 'Submission not found');
    } catch (error) {
        console.error('submission status not saved', {
            id: input.data.id,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return failure('SAVE_FAILED', 'Could not save the status. Try again.');
    }

    revalidatePath('/[locale]/dashboard/submissions', 'layout');
    return { data: { status: input.data.status } };
}

/** Zapisuje wpis na bazie i pliki w repo, wiec poza `next dev` odmawia nawet z dostepem. */
export async function publishSubmission(id: string): Promise<PublishSubmissionResult> {
    if (!(await hasDashboardAccess())) return failure('FORBIDDEN', 'Access denied');
    if (!isSubmissionPublishingEnabled()) {
        return { error: { code: 'LOCAL_ONLY', message: 'Publishing works only in local next dev.' } };
    }

    const input = idSchema.safeParse(id);
    if (!input.success) return failure('BAD_INPUT', 'Invalid submission');

    try {
        const result = await publishServiceSubmission(input.data);
        if (!result.ok) return { error: { code: result.code, message: result.message } };

        revalidatePath('/[locale]/dashboard/submissions', 'layout');
        return { data: result.data };
    } catch (error) {
        console.error('submission publish failed', {
            id: input.data,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return failure('SAVE_FAILED', 'Could not publish the submission. Try again.');
    }
}

/** Trwale usuwa zgloszenie: regulamin ogranicza czas przechowywania danych zglaszajacego. */
export async function deleteSubmission(id: string): Promise<DeleteSubmissionResult> {
    if (!(await hasDashboardAccess())) return failure('FORBIDDEN', 'Access denied');

    const input = idSchema.safeParse(id);
    if (!input.success) return failure('BAD_INPUT', 'Invalid submission');

    try {
        const isDeleted = await deleteServiceSubmission(input.data);
        if (!isDeleted) return failure('NOT_FOUND', 'Submission not found');
    } catch (error) {
        console.error('submission not deleted', {
            id: input.data,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return failure('SAVE_FAILED', 'Could not delete the submission. Try again.');
    }

    revalidatePath('/[locale]/dashboard/submissions', 'page');
    return { data: { id: input.data } };
}

/**
 * Mail juz poszedl, wiec blad zapisu daty nie moze wrocic jako porazka wysylki: operator
 * wyslalby drugi raz. `null` mowi formularzowi, ze sladu w bazie nie ma.
 */
async function recordReplySent(id: string): Promise<string | null> {
    try {
        const sentAt = await markServiceSubmissionReplySent(id, new Date());
        return sentAt?.toISOString() ?? null;
    } catch (error) {
        console.error('submission reply sent but date not saved', {
            id,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return null;
    }
}

/**
 * Odbiorca pochodzi z wiersza, nigdy z wejscia: akcja nie moze sluzyc do wysylki na dowolny adres.
 * Tylko po dodaniu firmy, bo tresc mowi, ze wpis jest juz w katalogu. Ponowna wysylka wymaga
 * `isResendConfirmed`: formularz otwarty przed pierwsza wysylka (druga karta) o niej nie wie.
 */
export async function sendSubmissionReply(
    id: string,
    subject: string,
    text: string,
    isResendConfirmed = false,
): Promise<SendSubmissionReplyResult> {
    if (!(await hasDashboardAccess())) return failure('FORBIDDEN', 'Access denied');

    const input = replySchema.safeParse({ id, subject, text });
    if (!input.success) return failure('BAD_INPUT', 'Fill in the subject and message.');

    try {
        const submission = await getServiceSubmission(input.data.id);
        if (!submission) return failure('NOT_FOUND', 'Submission not found');
        if (submission.status !== 'added') {
            return {
                error: { code: 'NOT_PUBLISHED', message: 'Publish the submission first.' },
            };
        }
        if (submission.replySentAt && isResendConfirmed !== true) {
            return {
                error: {
                    code: 'ALREADY_SENT',
                    message: 'A reply was already sent. Reload the page to see when.',
                },
            };
        }

        const sent = await sendMail({
            to: submission.submitterEmail,
            subject: input.data.subject,
            text: input.data.text,
        });
        if (!sent.ok) {
            return { error: { code: 'SEND_FAILED', message: SEND_FAILED_MESSAGE } };
        }
    } catch (error) {
        console.error('submission reply not sent', {
            id: input.data.id,
            reason: error instanceof Error ? error.name : 'unknown',
        });
        return { error: { code: 'SEND_FAILED', message: SEND_FAILED_MESSAGE } };
    }

    const sentAt = await recordReplySent(input.data.id);
    revalidatePath('/[locale]/dashboard/submissions', 'layout');
    return { data: { id: input.data.id, sentAt } };
}
