'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
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

    return (
        <div
            className={cn(
                'pointer-events-auto absolute z-50 w-[260px] origin-bottom rounded-xl border border-gray-200 bg-white p-3 shadow-lg',
                'dark:border-gray-700 dark:bg-gray-800',
                'motion-safe:transition-[opacity,transform] motion-safe:duration-[600ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
                visible
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-2 scale-95 pointer-events-none',
            )}
            style={style}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header: voivodeship name */}
            <div className="flex items-center gap-2">
                <span className="text-sm" aria-hidden="true">📍</span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {pin.voivodeship}
                </span>
            </div>

            {/* Info: companies in categories */}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('autoTooltip', { count: pin.placesCount, categories: pin.categoriesCount })}
            </p>

            {/* CTA */}
            <Link
                href="/map"
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
