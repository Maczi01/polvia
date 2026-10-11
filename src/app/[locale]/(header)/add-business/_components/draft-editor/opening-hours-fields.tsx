'use client';

import { useTranslations } from 'next-intl';
import { type JSX, useId } from 'react';

import { Input } from '@/components/ui/input/input';
import { WEEKDAY_KEYS, type Weekday } from '@/db/service-input-schema';
import type { FieldErrors } from '@/lib/add-business/types';

import { controlClasses, describedBy, FieldError } from '../form-field/form-field';
import type { DayHoursValue, HoursValues } from './draft-values';

interface OpeningHoursFieldsProps {
    hours: HoursValues;
    fieldErrors: FieldErrors;
    onChange: (day: Weekday, value: DayHoursValue) => void;
}

/** Nazwy pol jak w `parseOwnerEdits`: `hours.<day>.open|close`; pusta para = dzien zamkniety. */
export function OpeningHoursFields({
    hours,
    fieldErrors,
    onChange,
}: OpeningHoursFieldsProps): JSX.Element {
    const t = useTranslations('addBusiness');
    const baseId = useId();
    const hintId = `${baseId}-hint`;

    return (
        <fieldset className="space-y-3" aria-describedby={hintId}>
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('fields.openingHours')}
            </legend>
            <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
                {t('hours.hint')}
            </p>
            {WEEKDAY_KEYS.map(day => {
                const dayLabel = t(`hours.days.${day}`);
                const openError = fieldErrors[`hours.${day}.open`];
                const closeError = fieldErrors[`hours.${day}.close`];
                const error = openError ?? closeError;
                const errorId = `${baseId}-${day}-error`;
                const value = hours[day];

                return (
                    <div key={day} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
                        <span aria-hidden className="text-sm text-gray-700 dark:text-gray-300">
                            {dayLabel}
                        </span>
                        <Input
                            type="time"
                            name={`hours.${day}.open`}
                            aria-label={t('hours.open', { day: dayLabel })}
                            value={value.open}
                            onChange={event =>
                                onChange(day, { ...value, open: event.target.value })
                            }
                            aria-invalid={openError ? true : undefined}
                            aria-describedby={describedBy(openError ? errorId : null)}
                            className={controlClasses(Boolean(openError))}
                        />
                        <Input
                            type="time"
                            name={`hours.${day}.close`}
                            aria-label={t('hours.close', { day: dayLabel })}
                            value={value.close}
                            onChange={event =>
                                onChange(day, { ...value, close: event.target.value })
                            }
                            aria-invalid={closeError ? true : undefined}
                            aria-describedby={describedBy(closeError ? errorId : null)}
                            className={controlClasses(Boolean(closeError))}
                        />
                        {error && <FieldError id={errorId} error={error} className="col-span-3" />}
                    </div>
                );
            })}
        </fieldset>
    );
}
