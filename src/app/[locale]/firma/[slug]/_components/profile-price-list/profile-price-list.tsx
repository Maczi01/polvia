import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { ProfileSection } from '../profile-section/profile-section';
import type { PriceListItem } from '../service-profile-types';

type ProfilePriceListProps = {
    items: readonly PriceListItem[];
    className?: string;
    titleClassName?: string;
};

/** Pozycje w kolejnosci z danych; cena to tekst firmy („od 120 zl/m²”), nie liczba. */
export function ProfilePriceList({
    items,
    className,
    titleClassName,
}: ProfilePriceListProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');

    if (items.length === 0) return null;

    return (
        <ProfileSection
            id="price-list"
            title={t('priceList')}
            className={className}
            titleClassName={titleClassName}
        >
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(item => (
                    <li key={item.name} className="flex items-baseline gap-3 py-3.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                            {item.note && (
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                    {item.note}
                                </p>
                            )}
                        </div>
                        <span
                            aria-hidden="true"
                            className="min-w-6 flex-1 translate-y-[-0.3em] border-b border-dotted border-gray-300 dark:border-gray-600"
                        />
                        <p className="shrink-0 whitespace-nowrap text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {item.price}
                        </p>
                    </li>
                ))}
            </ul>
        </ProfileSection>
    );
}
