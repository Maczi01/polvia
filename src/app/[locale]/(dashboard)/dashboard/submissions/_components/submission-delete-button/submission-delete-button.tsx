'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button/button';
import { useRouter } from '@/i18n/navigation';

import { deleteSubmission } from '../../_actions';

const UNREACHABLE_MESSAGE = 'Could not reach the server. Try again.';

interface SubmissionDeleteButtonProps {
    id: string;
    name: string;
}

export function SubmissionDeleteButton({ id, name }: SubmissionDeleteButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleDelete = () => {
        if (!confirm(`Delete the submission from "${name}"? This cannot be undone.`)) return;
        setError(null);
        startTransition(async () => {
            try {
                const result = await deleteSubmission(id);
                if (result.error) {
                    setError(result.error.message);
                    return;
                }
                router.replace('/dashboard/submissions');
            } catch (error_) {
                console.error('submission delete request failed', error_);
                setError(UNREACHABLE_MESSAGE);
            }
        });
    };

    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="border border-destructive px-3 text-destructive"
                disabled={isPending}
                onClick={handleDelete}
            >
                Delete
            </Button>
            <p aria-live="polite" className="text-sm text-destructive">
                {error}
            </p>
        </div>
    );
}
