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
import { formatReplySentAt } from '@/lib/submission-reply-sent-at';

import { sendSubmissionReply } from '../../_actions';

const UNREACHABLE_MESSAGE = 'Could not reach the server. Try again.';

type SendState =
    | { status: 'idle' }
    | { status: 'sent'; isDateSaved: boolean }
    | { status: 'failed'; message: string };

interface SubmissionReplyFormProps {
    id: string;
    to: string;
    locale: string;
    hasPremiumConsent: boolean;
    initialSubject: string;
    initialText: string;
    /** ISO z `service_submissions.reply_sent_at`; `null` = jeszcze nic nie wyslano. */
    sentAt: string | null;
}

function confirmMessage(to: string, lastSentAt: string | null): string {
    if (!lastSentAt) return `Send this email to ${to}?`;
    return `A reply was already sent on ${formatReplySentAt(new Date(lastSentAt))}. Send again to ${to}?`;
}

/** Data wysylki jest w bazie; „sent” w stanie tylko blokuje przycisk do kolejnej edycji. */
export function SubmissionReplyForm({
    id,
    to,
    locale,
    hasPremiumConsent,
    initialSubject,
    initialText,
    sentAt,
}: SubmissionReplyFormProps) {
    const fieldId = useId();
    const [isPending, startTransition] = useTransition();
    const [subject, setSubject] = useState(initialSubject);
    const [text, setText] = useState(initialText);
    const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
    const [lastSentAt, setLastSentAt] = useState(sentAt);

    const isLinkMissing = text.includes(REPLY_LINK_PLACEHOLDER);
    const isSendable =
        subject.trim().length > 0 && text.trim().length > 0 && !isLinkMissing && !isPending;

    const handleSend = () => {
        if (!confirm(confirmMessage(to, lastSentAt))) return;
        setSendState({ status: 'idle' });
        startTransition(async () => {
            try {
                const result = await sendSubmissionReply(id, subject, text, lastSentAt !== null);
                if (result.error) {
                    setSendState({ status: 'failed', message: result.error.message });
                    return;
                }
                if (result.data.sentAt) setLastSentAt(result.data.sentAt);
                setSendState({ status: 'sent', isDateSaved: result.data.sentAt !== null });
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
                {lastSentAt && (
                    <p className="text-sm font-medium">
                        Reply sent on {formatReplySentAt(new Date(lastSentAt))}.
                    </p>
                )}
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
                {isPending ? 'Sending…' : lastSentAt ? 'Send again' : 'Send email'}
            </Button>
            <p aria-live="polite" className="text-sm">
                {sendState.status === 'sent' &&
                    (sendState.isDateSaved
                        ? `Sent to ${to}.`
                        : `Sent to ${to}, but the send date was not saved.`)}
                {sendState.status === 'failed' && (
                    <span className="text-destructive">{sendState.message}</span>
                )}
            </p>
        </section>
    );
}
