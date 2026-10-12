import type { AnchorHTMLAttributes, JSX, ReactNode } from 'react';

type Href = string | { pathname: string; query?: Record<string, string> };

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
    href: Href;
    children: ReactNode;
}

/**
 * Zamiennik `Link` z `@/i18n/navigation` (routing next-intl ciagnie ESM i App Router).
 * Renderuje WEWNETRZNA sciezke (`/map?place=…`): lokalizacja to zadanie next-intl.
 * Uzycie: `jest.mock('@/i18n/navigation', () => jest.requireActual('../test-utils/navigation-mock'))`.
 */
export function Link({ href, children, ...rest }: LinkProps): JSX.Element {
    const url =
        typeof href === 'string'
            ? href
            : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ''}`;

    return (
        <a href={url} {...rest}>
            {children}
        </a>
    );
}
