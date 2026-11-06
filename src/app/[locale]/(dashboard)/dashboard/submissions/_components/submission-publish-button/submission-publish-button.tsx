'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button/button';
import { Link, useRouter } from '@/i18n/navigation';
import type { PublishedSubmission } from '@/lib/publish-submission';

import { publishSubmission } from '../../_actions';

const UNREACHABLE_MESSAGE = 'Could not reach the server. Try again.';

interface SubmissionPublishButtonProps {
    id: string;
    name: string;
    isPublished: boolean;
}

/** Wynik zostaje w stanie, bo po odswiezeniu zgloszenie jest juz opublikowane i przycisku nie ma. */
export function SubmissionPublishButton({ id, name, isPublished }: SubmissionPublishButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [published, setPublished] = useState<PublishedSubmission | null>(null);

    const handlePublish = () => {
        if (!confirm(`Publish "${name}"? It goes to the production catalog right away.`)) return;
        setError(null);
        startTransition(async () => {
            try {
                const result = await publishSubmission(id);
                if (result.error) {
                    setError(result.error.message);
                    return;
                }
                setPublished(result.data);
                router.refresh();
            } catch (error_) {
                console.error('submission publish request failed', error_);
                setError(UNREACHABLE_MESSAGE);
            }
        });
    };

    return (
        <div className="space-y-2">
            {!isPublished && (
                <Button
                    type="button"
                    size="sm"
                    className="px-3"
                    disabled={isPending}
                    onClick={handlePublish}
                >
                    {isPending ? 'Publishing…' : 'Publish'}
                </Button>
            )}
            <p aria-live="polite" className="text-sm text-destructive">
                {error}
            </p>
            <div aria-live="polite">
                {published && (
                    <div className="space-y-2 rounded-md border p-3 text-sm">
                        <p className="font-medium">
                            Published:{' '}
                            <Link
                                href={{
                                    pathname: '/firma/[slug]',
                                    params: { slug: published.serviceSlug },
                                }}
                                className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                                /firma/{published.serviceSlug}
                            </Link>
                        </p>
                        <p>Commit and deploy these files, otherwise the logo returns 404:</p>
                        <ul className="list-disc pl-5 font-mono text-xs">
                            {published.files.map(file => (
                                <li key={file}>{file}</li>
                            ))}
                        </ul>
                        {!published.isSearchIndexed && (
                            <p className="text-destructive">
                                Not added to search yet. Run: npm run db:embeddings
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
