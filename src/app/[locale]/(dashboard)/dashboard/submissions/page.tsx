import { notFound } from 'next/navigation';

import { Link } from '@/i18n/navigation';
import { hasDashboardAccess } from '@/lib/dashboard-access';
import { listServiceSubmissions } from '@/lib/service-submissions';

import { SubmissionStatusBadge } from './_components/submission-status-badge';

const HEADERS = ['Name', 'Category', 'City', 'Submitted by', 'Date', 'Status'];

export default async function SubmissionsPage() {
    if (!(await hasDashboardAccess())) notFound();

    const submissions = await listServiceSubmissions();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Submissions</h1>
                <p className="text-muted-foreground">
                    Companies submitted through the public form, waiting for review
                </p>
            </div>

            {submissions.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                {HEADERS.map(header => (
                                    <th key={header} className="px-4 py-3 text-left font-medium">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.map(submission => (
                                <tr key={submission.id} className="border-b last:border-0">
                                    <td className="px-4 py-3 font-medium">
                                        <Link
                                            href={{
                                                pathname: '/dashboard/submissions/[id]',
                                                params: { id: submission.id },
                                            }}
                                            className="text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                            {submission.name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {submission.entry.category}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {submission.entry.locations[0]?.city || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                        {submission.submitterEmail}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                        {submission.createdAt.toISOString().slice(0, 10)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <SubmissionStatusBadge status={submission.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
