'use client';

import { useTranslations } from 'next-intl';
import type { ChangeEvent, JSX } from 'react';

import { Link } from '@/i18n/navigation';
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
            <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                    type="checkbox"
                    name="premiumInfoConsent"
                    className="mt-0.5 size-4 shrink-0 accent-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                />
                {t('fields.premiumConsent')}
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {t.rich('fields.privacyNotice', {
                    link: chunks => (
                        // Nowa karta: formularz trzyma stan tylko w pamieci przegladarki.
                        <Link
                            href="/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-gray-900 dark:hover:text-gray-100"
                        >
                            {chunks}
                        </Link>
                    ),
                })}
            </p>
        </>
    );
}
