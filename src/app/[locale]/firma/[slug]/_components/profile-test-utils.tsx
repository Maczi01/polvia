import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';

import messages from '../../../../../../messages/pl.json';

/** Render z prawdziwymi tlumaczeniami `pl` — asercje sprawdzaja tekst widoczny dla uzytkownika. */
export function renderWithIntl(ui: ReactElement): RenderResult {
    return render(
        <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
            {ui}
        </NextIntlClientProvider>,
    );
}

function hrefToString(href: unknown): string {
    if (typeof href === 'string') return href;
    if (typeof href === 'object' && href !== null && 'pathname' in href) {
        return String(href.pathname);
    }
    return '';
}

type MockLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: unknown;
    children: ReactNode;
};

/**
 * Zastepstwo `Link` z `@/i18n/navigation` (routing next-intl ciagnie App Router).
 * Renderuje wewnetrzna sciezke; lokalizacja adresu to zadanie next-intl.
 * Uzycie: `jest.mock('@/i18n/navigation', () => ({ Link: jest.requireActual('…/profile-test-utils').MockLink }))`.
 */
export function MockLink({ href, children, ...rest }: MockLinkProps): ReactElement {
    return (
        <a href={hrefToString(href)} {...rest}>
            {children}
        </a>
    );
}
