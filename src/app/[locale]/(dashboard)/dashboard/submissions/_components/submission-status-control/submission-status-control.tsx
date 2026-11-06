'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button/button';
import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/lib/submission-status';

import { updateSubmissionStatus } from '../../_actions';

const UNREACHABLE_MESSAGE = 'Could not reach the server. Try again.';

const ACTION_LABELS: Record<SubmissionStatus, string> = {
    new: 'Reopen',
    added: 'Mark as added',
    rejected: 'Reject',
};

interface SubmissionStatusControlProps {
    id: string;
    status: SubmissionStatus;
}

export function SubmissionStatusControl({ id, status }: SubmissionStatusControlProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleChange = (next: SubmissionStatus) => {
        setError(null);
        startTransition(async () => {
            try {
                const result = await updateSubmissionStatus(id, next);
                if (result.error) setError(result.error.message);
            } catch (error_) {
                // Akcja rzuca przy zerwanej sieci albo po wylogowaniu; bez tego blad
                // trafilby do granicy bledow i zastapil cala strone zgloszenia.
                console.error('submission status request failed', error_);
                setError(UNREACHABLE_MESSAGE);
            }
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {SUBMISSION_STATUSES.filter(option => option !== status).map(option => (
                    <Button
                        key={option}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border px-3"
                        disabled={isPending}
                        onClick={() => handleChange(option)}
                    >
                        {ACTION_LABELS[option]}
                    </Button>
                ))}
            </div>
            <p aria-live="polite" className="text-sm text-destructive">
                {error}
            </p>
        </div>
    );
}
