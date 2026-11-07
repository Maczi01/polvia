'use client';

import { useId, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button/button';
import { Input } from '@/components/ui/input/input';
import { Textarea } from '@/components/ui/textarea';
import {
    REPLY_LINK_PLACEHOLDER,
    REPLY_SUBJECT_MAX_LENGTH,
    REPLY_TEXT_MAX_LENGTH,
} from '@/lib/submission-reply-limits';

import { sendSubmissionReply } from '../../_actions';

const UNREACHABLE_MESSAGE = 'Could not reach the server. Try again.';

type SendState =
    | { status: 'idle' }
    | { status: 'sent' }
    | { status: 'failed'; message: string };

interface SubmissionReplyFormProps {
    id: string;
    to: string;
    locale: string;
    hasPremiumConsent: boolean;
    initialSubject: string;
    initialText: string;
}

/** Wysylka nie zostawia sladu w bazie, wiec „sent” trwa do edycji albo odswiezenia strony. */
export function SubmissionReplyForm({
    id,
    to,
    locale,
    hasPremiumConsent,
    initialSubject,
    initialText,
}: SubmissionReplyFormProps) {
    const fieldId = useId();
    const [isPending, startTransition] = useTransition();
    const [subject, setSubject] = useState(initialSubject);
    const [text, setText] = useState(initialText);
    const [sendState, setSendState] = useState<SendState>({ status: 'idle' });

    const isLinkMissing = text.includes(REPLY_LINK_PLACEHOLDER);
    const isSendable =
        subject.trim().length > 0 && text.trim().length > 0 && !isLinkMissing && !isPending;

    const handleSend = () => {
        if (!confirm(`Send this email to ${to}?`)) return;
        setSendState({ status: 'idle' });
        startTransition(async () => {
            try {
                const result = await sendSubmissionReply(id, subject, text);
                setSendState(
                    result.error
                        ? { status: 'failed', message: result.error.message }
                        : { status: 'sent' },
                );
            } catch (error) {
                console.error('submission reply request failed', error);
                setSendState({ status: 'failed', message: UNREACHABLE_MESSAGE });
            }
        });
    };

    return (
        <section className="space-y-3 rounded-md border p-4">
            <div>
                <h2 className="text-lg font-semibold">Reply to submitter</h2>
                <p className="text-sm text-muted-foreground">
                    To {to}, in the submission language ({locale}). Edit before sending.
                </p>
                <p className="text-sm text-muted-foreground">
                    {hasPremiumConsent
                        ? 'The submitter agreed to premium information, so the message includes it.'
                        : 'No consent to premium information: do not add an offer to this message.'}
                </p>
            </div>
            <div className="space-y-1">
                <label htmlFor={`${fieldId}-subject`} className="text-sm font-medium">
                    Subject
                </label>
                <Input
                    id={`${fieldId}-subject`}
                    value={subject}
                    maxLength={REPLY_SUBJECT_MAX_LENGTH}
                    onChange={event => {
                        setSubject(event.target.value);
                        setSendState({ status: 'idle' });
                    }}
                />
            </div>
            <div className="space-y-1">
                <label htmlFor={`${fieldId}-text`} className="text-sm font-medium">
                    Message
                </label>
                <Textarea
                    id={`${fieldId}-text`}
                    rows={9}
                    value={text}
                    maxLength={REPLY_TEXT_MAX_LENGTH}
                    onChange={event => {
                        setText(event.target.value);
                        setSendState({ status: 'idle' });
                    }}
                />
            </div>
            <p aria-live="polite" className="text-sm text-destructive">
                {isLinkMissing &&
                    `No single published entry has this name. Replace ${REPLY_LINK_PLACEHOLDER} with the profile link.`}
            </p>
            <Button
                type="button"
                size="sm"
                className="px-3"
                disabled={!isSendable || sendState.status === 'sent'}
                onClick={handleSend}
            >
                {isPending ? 'Sending…' : 'Send email'}
            </Button>
            <p aria-live="polite" className="text-sm">
                {sendState.status === 'sent' && `Sent to ${to}.`}
                {sendState.status === 'failed' && (
                    <span className="text-destructive">{sendState.message}</span>
                )}
            </p>
        </section>
    );
}
