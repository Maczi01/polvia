import { cn } from '@/lib/utilities';
import type { SubmissionStatus } from '@/lib/submission-status';

const STATUS_STYLES: Record<SubmissionStatus, string> = {
    new: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    added: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    rejected: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_STYLES[status],
            )}
        >
            {status}
        </span>
    );
}
