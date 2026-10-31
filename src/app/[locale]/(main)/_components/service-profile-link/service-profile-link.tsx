import type { ComponentProps, ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utilities';

type ServiceProfileLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
    /** Slug uslugi — adres `/firma/<slug>`. */
    slug: string;
};

/**
 * Link do profilu firmy z karty i popupu mapy. Bez prefetchu: prefetch profilu
 * przechodzi przez lookup slugu w middleware, a lista renderuje dziesiatki kart
 * naraz — kazda widoczna karta zjadalaby limit lookupu.
 */
export function ServiceProfileLink({
    slug,
    className,
    ...rest
}: ServiceProfileLinkProps): ReactElement {
    return (
        <Link
            {...rest}
            href={{ pathname: '/firma/[slug]', params: { slug } }}
            prefetch={false}
            className={cn(
                'font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                className,
            )}
        />
    );
}
