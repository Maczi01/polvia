'use client';

import { useTranslations } from 'next-intl';
import { type JSX, useId } from 'react';

import { LANGUAGE_CODES, type LanguageCode } from '@/lib/add-business/draft-schema';
import type { FieldErrorKey } from '@/lib/add-business/types';

import { describedBy, FieldError } from '../form-field/form-field';

interface LanguagesFieldProps {
    selected: readonly LanguageCode[];
    error: FieldErrorKey | undefined;
    onChange: (languages: LanguageCode[]) => void;
}

/** Jezyki obslugi (R8): grupa checkboxow `languages`, serwer czyta je przez `getAll`. */
export function LanguagesField({ selected, error, onChange }: LanguagesFieldProps): JSX.Element {
    const t = useTranslations('addBusiness');
    const errorId = `${useId()}-error`;

    function toggle(code: LanguageCode, isChecked: boolean): void {
        const next = isChecked ? [...selected, code] : selected.filter(item => item !== code);
        onChange(LANGUAGE_CODES.filter(item => next.includes(item)));
    }

    return (
        <fieldset className="space-y-2" aria-describedby={describedBy(error ? errorId : null)}>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('fields.languages')}
            </legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                {LANGUAGE_CODES.map(code => (
                    <label
                        key={code}
                        className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                    >
                        <input
                            type="checkbox"
                            name="languages"
                            value={code}
                            checked={selected.includes(code)}
                            onChange={event => toggle(code, event.target.checked)}
                            className="size-4 accent-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                        />
                        {t(`languages.${code}`)}
                    </label>
                ))}
            </div>
            {error && <FieldError id={errorId} error={error} />}
        </fieldset>
    );
}
