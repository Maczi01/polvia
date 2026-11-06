import { Download } from 'lucide-react';
import { notFound } from 'next/navigation';

import { Link } from '@/i18n/navigation';
import { hasDashboardAccess } from '@/lib/dashboard-access';
import { isSubmissionPublishingEnabled } from '@/lib/publish-submission';
import { getServiceSubmission } from '@/lib/service-submissions';

import { SubmissionDeleteButton } from '../_components/submission-delete-button/submission-delete-button';
import { SubmissionDetails } from '../_components/submission-details/submission-details';
import { SubmissionPublishButton } from '../_components/submission-publish-button/submission-publish-button';
import { SubmissionStatusBadge } from '../_components/submission-status-badge';
import { SubmissionStatusControl } from '../_components/submission-status-control/submission-status-control';

const DOWNLOAD_CLASS =
    'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted';

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
    if (!(await hasDashboardAccess())) notFound();

    const { id } = await params;
    const submission = await getServiceSubmission(id);
    if (!submission) notFound();

    const basePath = `/dashboard/submissions/${submission.id}`;

    return (
        <div className="max-w-4xl space-y-6">
            <div className="space-y-3">
                <Link
                    href="/dashboard/submissions"
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                    All submissions
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                    {submission.hasLogo && (
                        <img
                            src={`${basePath}/logo`}
                            alt={`${submission.name} logo`}
                            className="size-16 rounded-md border object-contain"
                        />
                    )}
                    <h1 className="text-2xl font-bold">{submission.name}</h1>
                    <SubmissionStatusBadge status={submission.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                    <a href={`${basePath}/json`} className={DOWNLOAD_CLASS}>
                        <Download className="size-4" />
                        Download JSON
                    </a>
                    {submission.hasLogo && (
                        <a href={`${basePath}/logo?download=1`} className={DOWNLOAD_CLASS}>
                            <Download className="size-4" />
                            Download logo
                        </a>
                    )}
                </div>
                <SubmissionStatusControl id={submission.id} status={submission.status} />
                {isSubmissionPublishingEnabled() && (
                    <SubmissionPublishButton
                        id={submission.id}
                        name={submission.name}
                        isPublished={submission.status === 'added'}
                    />
                )}
                <SubmissionDeleteButton id={submission.id} name={submission.name} />
            </div>

            <SubmissionDetails submission={submission} />
        </div>
    );
}
