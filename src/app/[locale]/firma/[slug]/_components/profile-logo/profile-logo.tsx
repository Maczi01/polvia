import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utilities';

const FALLBACK_LOGO = '/default.png';

type ProfileLogoProps = {
    name: string;
    /** Sciezka obrazka albo `null` — wtedy zastepczy `/default.png` (jak w karcie uslugi). */
    logo: string | null;
    size: number;
    className?: string;
    priority?: boolean;
};

export function ProfileLogo({
    name,
    logo,
    size,
    className,
    priority = false,
}: ProfileLogoProps): ReactElement {
    const t = useTranslations('ServiceProfile');

    return (
        <Image
            src={logo ?? FALLBACK_LOGO}
            alt={t('logoAlt', { name })}
            width={size}
            height={size}
            priority={priority}
            className={cn(
                'shrink-0 border border-gray-200 bg-white object-contain dark:border-gray-600',
                className,
            )}
        />
    );
}
