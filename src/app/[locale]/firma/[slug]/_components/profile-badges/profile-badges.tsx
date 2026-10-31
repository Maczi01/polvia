import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge/badge';
import { VerifiedBadge } from '@/components/ui/verified-badge/verified-badge';
import { getCategoryMessageKey } from '@/lib/categories';
import { mapCategoryToBadgeColor } from '@/lib/consts';
import type { Coverage } from '@/lib/coverage';
import { cn } from '@/lib/utilities';

type ProfileBadgesProps = {
    category: string;
    coverage: Coverage;
    verified: boolean;
    className?: string;
};

/**
 * Kategoria, zasieg i weryfikacja. Zasieg `local` nie ma etykiety — jak w karcie,
 * oznaczamy tylko obsluge zdalna, bo tego uzytkownik nie wywnioskuje z adresu.
 */
export function ProfileBadges({
    category,
    coverage,
    verified,
    className,
}: ProfileBadgesProps): ReactElement {
    const t = useTranslations('ServiceProfile');
    const tCategories = useTranslations('MapPage.Categories');

    return (
        <ul className={cn('flex flex-wrap items-center gap-2', className)}>
            <li>
                <Badge
                    variant={mapCategoryToBadgeColor(category)}
                    label={tCategories(getCategoryMessageKey(category))}
                />
            </li>
            {coverage !== 'local' && (
                <li>
                    <Badge variant="aqua" label={t(`coverage.${coverage}`)} />
                </li>
            )}
            {verified && (
                <li>
                    <VerifiedBadge />
                </li>
            )}
        </ul>
    );
}
