import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge/badge';
import { Link } from '@/i18n/navigation';
import { getCategoryMessageKey } from '@/lib/categories';
import { mapCategoryToBadgeColor } from '@/lib/consts';
import { cn } from '@/lib/utilities';

import type { SimilarService } from '../service-profile-types';

type SimilarServicesProps = {
    services: readonly SimilarService[];
    className?: string;
};

/** Tylko darmowy profil (R3); strona premium nie poleca konkurencji (R10). */
export function SimilarServices({
    services,
    className,
}: SimilarServicesProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');
    const tCategories = useTranslations('MapPage.Categories');

    if (services.length === 0) return null;

    return (
        <section aria-labelledby="similar-heading" className={className}>
            <h2
                id="similar-heading"
                className="text-xl font-bold text-gray-900 dark:text-gray-100 md:text-2xl"
            >
                {t('similar')}
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {services.map(service => (
                    <li key={service.slug}>
                        {/* Bez prefetchu: kazdy prefetch profilu to lookup slugu w middleware. */}
                        <Link
                            href={service.href}
                            prefetch={false}
                            className={cn(
                                'group flex h-full flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-center transition-all md:p-5',
                                'hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2',
                                'dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-500',
                            )}
                        >
                            {/* Ozdobne: nazwa firmy jest tekstem linku. */}
                            <Image
                                src={service.logo ?? '/default.png'}
                                alt=""
                                width={64}
                                height={64}
                                className="size-16 rounded-xl border border-gray-100 bg-white object-contain dark:border-gray-600"
                            />
                            <span className="font-semibold leading-tight text-gray-900 group-hover:text-green-700 dark:text-gray-100 dark:group-hover:text-green-300">
                                {service.name}
                            </span>
                            {service.city && (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {service.city}
                                </span>
                            )}
                            <Badge
                                variant={mapCategoryToBadgeColor(service.category)}
                                label={tCategories(getCategoryMessageKey(service.category))}
                                className="mt-auto"
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
