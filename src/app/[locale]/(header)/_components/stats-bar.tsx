import React from 'react';
import { Search, ScrollText, CircleEllipsis, MapPinPlus, Rocket } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { serviceName, serviceNameFromCapitalLetter } from '@/lib/consts';

type StatDef = {
    id: string;
    icon: React.ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;
    value: string;
    label: string;
    description: string;
};

export const StatsBar = async () => {
    const t = await getTranslations('StatsBar');

    const stats: StatDef[] = [
        {
            id: 'search',
            icon: Search,
            value: '5000+',
            label: t('Card5.title'),
            description: t('Card5.description'),
        },
        {
            id: 'docs',
            icon: ScrollText,
            value: '400+',
            label: t('Card1.title'),
            description: t('Card1.description'),
        },
        {
            id: 'categories',
            icon: CircleEllipsis,
            value: '12',
            label: t('Card3.title'),
            description: t('Card3.description'),
        },
        {
            id: 'cities',
            icon: MapPinPlus,
            value: '2',
            label: t('Card2.title'),
            description: t('Card2.description'),
        },
        {
            id: 'launch',
            icon: Rocket,
            value: '1',
            label: t('Card4.title'),
            description: t('Card4.description'),
        },
    ];

    return (
        <section
            className="w-full overflow-hidden bg-[#F1FAF4] dark:bg-gray-800"
            aria-labelledby="stats-heading"
            role="region"
        >
            <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <h2
                        id="stats-heading"
                        className="text-2xl font-bold text-gray-900 dark:text-gray-100"
                    >
                        <Link className="text-green" href="/">
                            {serviceNameFromCapitalLetter}
                        </Link>
                        {t('title')}
                    </h2>
                </div>

                <div
                    className="mx-auto flex max-w-[1500px] flex-wrap justify-between py-6 gap-4"
                    role="list"
                    aria-label={`${t('statistics')} ${serviceName}`}
                >
                    {stats.map(({ id, icon: Icon, value, label, description }) => (
                        <div
                            key={id}
                            className="m-2 flex w-full flex-col items-center rounded-lg border border-gray-100 dark:border-gray-600 bg-white dark:bg-[#111827] p-4 shadow-sm dark:shadow-gray-900/20 transition duration-300 hover:shadow-md dark:hover:shadow-gray-900/30 md:w-48"
                            role="listitem"
                            aria-labelledby={`stat-${id}-label`}
                            aria-describedby={`stat-${id}-description`}
                        >
                            {/* Icon */}
                            <div className="mb-2 p-2 rounded-full bg-green-50 dark:bg-green-900/20">
                                <Icon
                                    className="text-green-500 dark:text-green-400"
                                    size={36}
                                    aria-hidden
                                />
                            </div>

                            {/* Value */}
                            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
                                {value}
                            </div>

                            {/* Label */}
                            <div
                                id={`stat-${id}-label`}
                                className="text-sm font-semibold text-green-600 dark:text-green-400 text-center mb-1"
                            >
                                {label}
                            </div>

                            {/* Description */}
                            <div
                                id={`stat-${id}-description`}
                                className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400 leading-relaxed"
                            >
                                {description}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
