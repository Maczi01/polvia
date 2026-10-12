'use client';

import { useTranslations } from 'next-intl';
import { type ChangeEvent, type FormEvent, type JSX, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import type { FieldErrorKey, FieldErrors } from '@/lib/add-business/types';

import type { EditingError, ReadyDraft } from '../add-business-flow/flow-state';
import { BusinessCardPreview } from '../business-card-preview/business-card-preview';
import { FlowHeading } from '../flow-heading/flow-heading';
import { ActionErrorNotice, SubmitLimitNotice } from '../flow-notices/flow-notices';
import { PRIMARY_BUTTON_CLASSES } from '../form-field/form-field';
import { BusinessFields } from './business-fields';
import {
    addressOf,
    type DraftValues,
    initialValues,
    previewFromValues,
    sameAddress,
    stillUnconfirmed,
} from './draft-values';
import { GeneratedSummary } from './generated-summary';
import { HoursSection } from './hours-section';
import { LanguagesField } from './languages-field';
import { logoFileError } from './logo-file';
import { PinPicker } from './pin-picker';
import { SocialFields } from './social-fields';
import { SubmissionFields } from './submission-fields';
import { usePinPicker } from './use-pin-picker';
import type { RelocateAction } from './use-relocation';

const HEADING_ID = 'add-business-editor-heading';

export interface DraftEditorProps {
    draft: ReadyDraft;
    fieldErrors: FieldErrors;
    error: EditingError | null;
    isPending: boolean;
    /** Logo do podgladu (upload → kandydat); `null` = placeholder karty. */
    logoSrc: string | null;
    onLogoChange: (file: File | null) => void;
    onSubmit: (formData: FormData) => void;
    onStartOver: () => void;
    relocateAction: RelocateAction;
}

/**
 * Krok 2 (R8–R12): podglad karty aktualizowany na zywo + pola, ktore wlasciciel moze
 * poprawic. Pola sa kontrolowane, zeby podglad i znaczniki „do uzupelnienia" nadazaly za
 * edycja; wysylka idzie przez `FormData` z formularza (nazwy jak w `parseOwnerEdits`).
 */
export function DraftEditor(props: DraftEditorProps): JSX.Element {
    const { draft, fieldErrors, error, isPending, logoSrc, onLogoChange, onSubmit } = props;
    const t = useTranslations('addBusiness');
    const [values, setValues] = useState<DraftValues>(() => initialValues(draft.preview));
    const [logoError, setLogoError] = useState<FieldErrorKey | null>(null);
    const picker = usePinPicker(draft, props.relocateAction);
    const { relocation } = picker;

    const preview = previewFromValues(draft.preview, values);
    // Odznaczone godziny to swiadome „bez godzin", nie pole do uzupelnienia.
    const unconfirmed = stillUnconfirmed(draft.unconfirmed, preview).filter(
        field => values.hoursEnabled || field !== 'openingHours',
    );
    const isOnline = draft.preview.coverage === 'online';
    const isAddressChanged = !sameAddress(addressOf(values), relocation.geocodedAddress);
    const relocationErrors =
        relocation.result?.status === 'invalid' ? relocation.result.fieldErrors : {};
    const errors: FieldErrors = {
        ...relocationErrors,
        ...fieldErrors,
        ...(logoError === null ? {} : { logo: logoError }),
    };
    const hasFieldErrors = Object.keys(fieldErrors).length > 0 || logoError !== null;

    const update = (patch: Partial<DraftValues>): void =>
        setValues(current => ({ ...current, ...patch }));

    /** Zly plik nie trafia do podgladu, a jego blad blokuje wysylke (patrz `logoFileError`). */
    function handleLogoChange(event: ChangeEvent<HTMLInputElement>): void {
        const file = event.target.files?.item(0) ?? null;
        const error = file === null ? null : logoFileError(file);
        setLogoError(error);
        onLogoChange(error === null ? file : null);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (isPending || logoError !== null) return;
        onSubmit(new FormData(event.currentTarget));
    }

    return (
        <section aria-labelledby={HEADING_ID} className="space-y-6">
            <div className="space-y-2">
                <FlowHeading id={HEADING_ID} shouldFocusOnMount>
                    {t('editor.heading')}
                </FlowHeading>
                <p className="text-gray-600 dark:text-gray-300">{t('editor.intro')}</p>
            </div>

            {typeof error === 'string' && <ActionErrorNotice code={error} />}
            {typeof error === 'object' && error !== null && (
                <SubmitLimitNotice retryAfter={error.retryAfter} />
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {t('editor.previewHeading')}
                    </h3>
                    <BusinessCardPreview
                        preview={preview}
                        unconfirmed={unconfirmed}
                        logoSrc={logoSrc}
                        pin={picker.pin}
                    />
                </div>

                <form noValidate onSubmit={handleSubmit} className="space-y-6">
                    <input type="hidden" name="draftId" value={draft.draftId} />
                    <GeneratedSummary
                        category={draft.preview.category}
                        coverage={draft.preview.coverage}
                        tags={draft.preview.tags}
                    />

                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {t('editor.formHeading')}
                    </h3>
                    <BusinessFields
                        values={values}
                        errors={errors}
                        onChange={(name, value) => update({ [name]: value })}
                        map={
                            !isOnline && (
                                <PinPicker
                                    picker={picker}
                                    isAddressChanged={isAddressChanged}
                                    error={errors.pin}
                                    onSearch={() => relocation.relocate(addressOf(values))}
                                />
                            )
                        }
                    />

                    <HoursSection
                        isEnabled={values.hoursEnabled}
                        hours={values.hours}
                        fieldErrors={errors}
                        onToggle={hoursEnabled => update({ hoursEnabled })}
                        onChange={(day, hours) =>
                            setValues(current => ({
                                ...current,
                                hours: { ...current.hours, [day]: hours },
                            }))
                        }
                    />
                    <LanguagesField
                        selected={values.languages}
                        error={errors.languages}
                        onChange={languages => update({ languages })}
                    />
                    <SocialFields
                        socials={values.socials}
                        whatsappNumber={values.whatsappNumber}
                        hasWhatsappLink={draft.preview.socials.whatsapp !== undefined}
                        fieldErrors={errors}
                        onSocialChange={(key, value) =>
                            setValues(current => ({
                                ...current,
                                socials: { ...current.socials, [key]: value },
                            }))
                        }
                        onWhatsappNumberChange={whatsappNumber => update({ whatsappNumber })}
                    />

                    <SubmissionFields errors={errors} onLogoChange={handleLogoChange} />

                    {hasFieldErrors && (
                        <p
                            role="alert"
                            className="text-sm font-medium text-red-600 dark:text-red-400"
                        >
                            {t('editor.fixErrors')}
                        </p>
                    )}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <Button
                            type="submit"
                            aria-disabled={isPending}
                            className={PRIMARY_BUTTON_CLASSES}
                        >
                            {isPending ? t('editor.submitting') : t('editor.submit')}
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            onClick={props.onStartOver}
                            disabled={isPending}
                            className="h-auto p-0 text-green-700 dark:text-green-400"
                        >
                            {t('editor.startOver')}
                        </Button>
                    </div>
                    <p
                        role="status"
                        aria-live="polite"
                        className="text-sm text-gray-700 dark:text-gray-300"
                    >
                        {isPending && t('editor.submitting')}
                    </p>
                </form>
            </div>
        </section>
    );
}
