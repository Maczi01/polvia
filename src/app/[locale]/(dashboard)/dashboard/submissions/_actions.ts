'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { hasDashboardAccess } from '@/lib/dashboard-access';
import {
    isSubmissionPublishingEnabled,
    publishServiceSubmission,
    type PublishedSubmission,
    type PublishErrorCode,
} from '@/lib/publish-submission';
import { deleteServiceSubmission, setServiceSubmissionStatus } from '@/lib/service-submissions';
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

const idSchema = z.string().uuid();

const inputSchema = z.object({
    id: idSchema,
    status: z.enum(SUBMISSION_STATUSES),
});

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
