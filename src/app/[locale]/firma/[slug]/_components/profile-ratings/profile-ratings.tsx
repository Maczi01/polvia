import { ExternalLink, Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { PREMIUM_RATING_MAX } from '@/lib/premium-ratings';
import { cn } from '@/lib/utilities';

import { ProfileSection } from '../profile-section/profile-section';
import type { ProfileRating } from '../service-profile-types';

type ProfileRatingsProps = {
    ratings: readonly ProfileRating[];
    className?: string;
    titleClassName?: string;
};

const STAR_POSITIONS = Array.from({ length: PREMIUM_RATING_MAX }, (_, index) => index + 1);

/** Gwiazdki tylko wizualnie — wartosc niesie dostepna nazwa linku. */
function RatingStars({ rating }: { rating: number }): ReactElement {
    const filled = Math.round(rating);

    return (
        <span aria-hidden="true" className="flex items-center gap-0.5">
            {STAR_POSITIONS.map(position => (
                <Star
                    key={position}
                    size={14}
                    className={cn(
                        position <= filled
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600',
                    )}
                />
            ))}
        </span>
    );
}

function RatingBadge({ rating }: { rating: ProfileRating }): ReactElement {
    const t = useTranslations('ServiceProfile.ratings');
    const format = useFormatter();
    const value = format.number(rating.rating, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    return (
        <li>
            <a
                href={rating.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('label', { source: rating.name, rating: value, count: rating.count })}
                className={cn(
                    'flex h-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors dark:border-gray-600 dark:bg-gray-800',
                    'hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:hover:bg-brand/20',
                )}
            >
                <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {rating.name}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                        <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-50">
                            {value}
                        </span>
                        <RatingStars rating={rating.rating} />
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        {t('count', { count: rating.count })}
                    </span>
                </span>
                <ExternalLink size={16} aria-hidden="true" className="shrink-0 text-gray-400" />
            </a>
        </li>
    );
}

/**
 * Oceny firmy z innych serwisow (premium): plakietka z nazwa serwisu, ocena, liczba opinii
 * i link do zrodla. Oceny wpisuje operator recznie (`premium.ratings`) — celowo nie trafiaja
 * do JSON-LD jako `aggregateRating`.
 */
export function ProfileRatings({
    ratings,
    className,
    titleClassName,
}: ProfileRatingsProps): ReactElement | null {
    const t = useTranslations('ServiceProfile.ratings');

    if (ratings.length === 0) return null;

    return (
        <ProfileSection
            id="ratings"
            title={t('title')}
            className={className}
            titleClassName={titleClassName}
        >
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {ratings.map(rating => (
                    <RatingBadge key={`${rating.source}:${rating.name}`} rating={rating} />
                ))}
            </ul>
        </ProfileSection>
    );
}
