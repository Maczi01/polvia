'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, type JSX, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import {
    MANUAL_DESCRIPTION_MAX,
    MANUAL_DESCRIPTION_MIN,
} from '@/lib/add-business/form-limits';
import type { ActionErrorCode, FieldErrors, ManualReason } from '@/lib/add-business/types';

import { FlowHeading } from '../flow-heading/flow-heading';
import { ActionErrorNotice } from '../flow-notices/flow-notices';
import { PRIMARY_BUTTON_CLASSES, TextAreaField, TextField } from '../form-field/form-field';
import { GenerationProgress, MANUAL_STAGES } from '../generation-progress/generation-progress';

const HEADING_ID = 'add-business-manual-heading';
const REASON_ID = 'add-business-manual-reason';

interface ManualStepProps {
    reason: ManualReason | null;
    prefillLink: string | null;
    fieldErrors: FieldErrors;
    error: ActionErrorCode | null;
    isPending: boolean;
    onGenerate: (formData: FormData) => void;
    onBack: () => void;
}

/**
 * Tryb reczny (R6): pola kluczowe + opis, z ktorego model pisze klasyfikacje i opisy.
 * Walidacja nalezy do serwera (`parseManualInput`) — odrzucenie nie zuzywa limitu
 * generowania, bo dzieje sie przed nim.
 */
export function ManualStep(props: ManualStepProps): JSX.Element {
    const { reason, prefillLink, fieldErrors, error, isPending, onGenerate, onBack } = props;
    const t = useTranslations('addBusiness');
    const [descriptionLength, setDescriptionLength] = useState(0);

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (isPending) return;
        onGenerate(new FormData(event.currentTarget));
    }

    return (
        <section aria-labelledby={HEADING_ID} className="space-y-6">
            <FlowHeading
                id={HEADING_ID}
                shouldFocusOnMount
                aria-describedby={reason ? REASON_ID : undefined}
            >
                {t('manual.heading')}
            </FlowHeading>

            {reason && (
                <p
                    id={REASON_ID}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
                >
                    {t(`manual.reasons.${reason}`)}
                </p>
            )}
            <p className="text-gray-600 dark:text-gray-300">{t('manual.intro')}</p>

            {error && <ActionErrorNotice code={error} />}

            <form
                noValidate
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-6 md:grid-cols-2"
            >
                <input type="hidden" name="mode" value="manual" />
                <TextField
                    name="name"
                    label={t('fields.name')}
                    autoComplete="organization"
                    error={fieldErrors.name}
                    isRequired
                />
                <TextField
                    name="link"
                    type="url"
                    inputMode="url"
                    label={t('fields.link')}
                    defaultValue={prefillLink ?? ''}
                    error={fieldErrors.link}
                />
                <TextField
                    name="street"
                    label={t('fields.street')}
                    autoComplete="address-line1"
                    error={fieldErrors.street}
                />
                <TextField
                    name="postcode"
                    label={t('fields.postcode')}
                    autoComplete="postal-code"
                    error={fieldErrors.postcode}
                />
                <TextField
                    name="city"
                    label={t('fields.city')}
                    autoComplete="address-level2"
                    error={fieldErrors.city}
                    isRequired
                />
                <TextField
                    name="phoneNumber"
                    type="tel"
                    label={t('fields.phoneNumber')}
                    autoComplete="tel"
                    error={fieldErrors.phoneNumber}
                />
                <TextField
                    name="email"
                    type="email"
                    label={t('fields.email')}
                    error={fieldErrors.email}
                />
                <div className="md:col-span-2">
                    <TextAreaField
                        name="description"
                        label={t('manual.descriptionLabel')}
                        hint={t('manual.descriptionHint', {
                            min: MANUAL_DESCRIPTION_MIN,
                            max: MANUAL_DESCRIPTION_MAX,
                        })}
                        maxLength={MANUAL_DESCRIPTION_MAX}
                        onChange={event => setDescriptionLength(event.target.value.length)}
                        error={fieldErrors.description}
                        isRequired
                        footer={
                            <p className="text-right text-xs text-gray-500 dark:text-gray-400">
                                {t('manual.counter', {
                                    count: descriptionLength,
                                    max: MANUAL_DESCRIPTION_MAX,
                                })}
                            </p>
                        }
                    />
                </div>

                <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:items-center">
                    <Button
                        type="submit"
                        aria-disabled={isPending}
                        className={PRIMARY_BUTTON_CLASSES}
                    >
                        {isPending ? t('link.generating') : t('manual.submit')}
                    </Button>
                    <Button
                        type="button"
                        variant="link"
                        onClick={onBack}
                        disabled={isPending}
                        className="h-auto p-0 text-green-700 dark:text-green-400"
                    >
                        {t('manual.backToLink')}
                    </Button>
                </div>
                <div className="md:col-span-2">
                    <GenerationProgress isActive={isPending} stages={MANUAL_STAGES} />
                </div>
            </form>
        </section>
    );
}
