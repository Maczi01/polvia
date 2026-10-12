'use client';

import { useTranslations } from 'next-intl';
import type { ChangeEvent, JSX } from 'react';

import { LOGO_ACCEPTED_TYPES, NOTES_MAX_LENGTH } from '@/lib/add-business/form-limits';
import type { FieldErrors } from '@/lib/add-business/types';

import { TextAreaField, TextField } from '../form-field/form-field';

interface SubmissionFieldsProps {
    errors: FieldErrors;
    onLogoChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** Sekcja „Zgloszenie": logo, e-mail zglaszajacego i uwagi dla operatora. */
export function SubmissionFields({ errors, onLogoChange }: SubmissionFieldsProps): JSX.Element {
    const t = useTranslations('addBusiness');

    return (
        <>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t('editor.contactHeading')}
            </h3>
            <TextField
                name="logo"
                type="file"
                accept={LOGO_ACCEPTED_TYPES.join(',')}
                label={t('fields.logo')}
                hint={t('fields.logoHint')}
                error={errors.logo}
                className="h-auto"
                onChange={onLogoChange}
            />
            <TextField
                name="submitterEmail"
                type="email"
                autoComplete="email"
                label={t('fields.submitterEmail')}
                hint={t('fields.submitterEmailHint')}
                error={errors.submitterEmail}
                isRequired
            />
            <TextAreaField
                name="notes"
                label={t('fields.notes')}
                hint={t('fields.notesHint')}
                maxLength={NOTES_MAX_LENGTH}
                error={errors.notes}
            />
        </>
    );
}
