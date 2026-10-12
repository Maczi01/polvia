'use client';

import { useTranslations } from 'next-intl';
import { type JSX, useId } from 'react';

import type { FieldErrors } from '@/lib/add-business/types';
import type { Weekday } from '@/lib/weekdays';

import type { DayHoursValue, HoursValues } from './draft-values';
import { OpeningHoursFields } from './opening-hours-fields';

interface HoursSectionProps {
    isEnabled: boolean;
    hours: HoursValues;
    fieldErrors: FieldErrors;
    onToggle: (isEnabled: boolean) => void;
    onChange: (day: Weekday, value: DayHoursValue) => void;
}

/**
 * Checkbox `hoursEnabled` (B): odznaczony = wpis bez godzin. Pola godzin znikaja z DOM-u,
 * wiec nie trafiaja do `FormData`; wpisane wartosci zostaja w stanie edytora na wypadek
 * ponownego zaznaczenia. Fokus zostaje na checkboxie, bo on sam nie jest odmontowywany.
 */
export function HoursSection(props: HoursSectionProps): JSX.Element {
    const { isEnabled, hours, fieldErrors, onToggle, onChange } = props;
    const t = useTranslations('addBusiness.editor');
    const regionId = useId();

    return (
        <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <input
                    type="checkbox"
                    name="hoursEnabled"
                    checked={isEnabled}
                    onChange={event => onToggle(event.target.checked)}
                    aria-controls={regionId}
                    className="size-4 accent-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                />
                {t('hoursEnabled')}
            </label>
            <div id={regionId}>
                {isEnabled && (
                    <OpeningHoursFields
                        hours={hours}
                        fieldErrors={fieldErrors}
                        onChange={onChange}
                    />
                )}
            </div>
        </div>
    );
}
