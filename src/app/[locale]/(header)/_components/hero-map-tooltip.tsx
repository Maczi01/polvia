'use client';

import type { CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buildMapUrl } from '@/lib/map-url-builder';
import type { AppPathnames } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utilities';
import type { HeroPin } from './hero-map-data';

type Props = {
    pin: HeroPin;
    style: CSSProperties;
    visible: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
};

export function HeroMapTooltip({ pin, style, visible, onMouseEnter, onMouseLeave }: Props) {
    const t = useTranslations('HeroMap');
    const tCat = useTranslations('Main');
    const locale = useLocale() as Locale;

    const rawUrl = pin.categoryKey
        ? buildMapUrl({ category: pin.categoryKey }, locale)
        : { pathname: '/map' };
    const mapUrl = {
        pathname: rawUrl.pathname as AppPathnames,
        query: 'query' in rawUrl ? rawUrl.query : undefined,
    };

    const categoryName = pin.categoryKey
        ? tCat(pin.svgLabel as 'Beauty' | 'Education' | 'Entertainment' | 'Financial' | 'Gastronomy' | 'Grocery' | 'Health' | 'Law' | 'Mechanics' | 'Others' | 'Renovation' | 'Transport')
        : pin.svgLabel;

    return (
        <div
            className={cn(
                'pointer-events-auto absolute z-50 w-[260px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg',
                'dark:border-gray-700 dark:bg-gray-800',
                'motion-safe:transition-opacity motion-safe:duration-[120ms] motion-safe:ease-out',
                visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            style={style}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header: icon + name + count */}
            <div className="flex items-center gap-2">
                <img src={pin.icon} alt="" width={20} height={20} className="shrink-0" />
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {categoryName}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-green/10 px-2 py-0.5 text-xs font-semibold text-green dark:bg-green-400/20 dark:text-green-400">
                    {pin.placesCount}
                </span>
            </div>

            {/* Cities */}
            {pin.exampleCities.length > 0 && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span aria-hidden="true">📍</span>{' '}
                    {t('exampleCities', { cities: pin.exampleCities.join(', ') })}
                </p>
            )}

            {/* Companies */}
            {pin.exampleCompanies.length > 0 && (
                <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
                    <span aria-hidden="true">🏢</span> {pin.exampleCompanies.join(', ')}
                </p>
            )}

            {/* CTA */}
            <Link
                href={mapUrl}
                className={cn(
                    'mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2',
                    'bg-green text-sm font-medium text-white',
                    'hover:bg-green/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/50',
                    'motion-safe:transition-colors',
                )}
            >
                {t('viewOnMap')}
                <span aria-hidden="true">&rarr;</span>
            </Link>
        </div>
    );
}
