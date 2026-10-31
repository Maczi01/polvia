import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utilities';
import { WEEKDAY_KEYS } from '@/lib/weekdays';

import { ProfileSection } from '../profile-section/profile-section';
import type { OpeningHours } from '../service-profile-types';

type ProfileHoursProps = {
    openingHours: OpeningHours;
    className?: string;
    titleClassName?: string;
};

/**
 * Caly tydzien, bez wyrozniania „dzis”: strona jest renderowana na serwerze i moze
 * byc cache'owana, wiec dzien z momentu renderu nie jest dniem uzytkownika.
 */
export function ProfileHours({
    openingHours,
    className,
    titleClassName,
}: ProfileHoursProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    if (!WEEKDAY_KEYS.some(day => openingHours[day])) return null;

    return (
        <ProfileSection
            id="hours"
            title={t('hours')}
            className={className}
            titleClassName={titleClassName}
        >
            <dl className="divide-y divide-gray-100 text-sm dark:divide-gray-700">
                {WEEKDAY_KEYS.map(day => {
                    const period = openingHours[day];
                    return (
                        <div key={day} className="flex items-center justify-between gap-4 py-2">
                            <dt className="text-gray-600 dark:text-gray-400">{t(`days.${day}`)}</dt>
                            <dd
                                className={cn(
                                    'tabular-nums',
                                    period
                                        ? 'font-medium text-gray-900 dark:text-gray-100'
                                        : 'text-gray-400 dark:text-gray-500',
                                )}
                            >
                                {period ? `${period.open} – ${period.close}` : t('closed')}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </ProfileSection>
    );
}
