import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';

import messages from '../../../../../../messages/pl.json';
import PremiumExamplePage, { generateMetadata } from './page';

// Granice: konfiguracja Stripe (env) i next-intl/server (request). Tlumaczenia metadanych
// zwracaja klucz z przestrzenia nazw — asercje sprawdzaja, ktory tekst trafia do tagow.
jest.mock('@/lib/stripe', () => ({ isStripeConfigured: false }));
jest.mock('next-intl/server', () => ({
    getTranslations:
        async ({ namespace }: { namespace: string }) =>
        (key: string) =>
            `${namespace}.${key}`,
    setRequestLocale: () => {},
}));

type MockHref = string | { pathname: string; query?: Record<string, string> };

function hrefToUrl(href: MockHref): string {
    if (typeof href === 'string') return href;
    const query = new URLSearchParams(href.query).toString();
    return query === '' ? href.pathname : `${href.pathname}?${query}`;
}

jest.mock('@/i18n/navigation', () => ({
    Link: ({
        href,
        children,
        prefetch: _prefetch,
        ...rest
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
        href: MockHref;
        prefetch?: boolean | null;
        children: ReactNode;
    }): ReactElement => (
        <a href={hrefToUrl(href)} {...rest}>
            {children}
        </a>
    ),
}));

async function renderPage(searchParams: Record<string, string | string[]>): Promise<void> {
    const page = await PremiumExamplePage({
        params: Promise.resolve({ locale: 'pl' }),
        searchParams: Promise.resolve(searchParams),
    });
    render(
        <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
            {page}
        </NextIntlClientProvider>,
    );
}

function currentTemplate(): HTMLElement {
    const nav = screen.getByRole('navigation', { name: 'Szablon strony' });
    return within(nav).getByRole('link', { current: 'page' });
}

describe('PremiumExamplePage', () => {
    it('metadane: noindex (follow), tytul i opis przykladu', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'pl' }),
            searchParams: Promise.resolve({}),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.title).toBe('ServiceProfile.example.metaTitle');
        expect(metadata.description).toBe('ServiceProfile.example.metaDescription');
    });

    it('?szablon=classic wybiera szablon Klasyczny', async () => {
        await renderPage({ szablon: 'classic' });

        expect(currentTemplate()).toHaveTextContent('Klasyczny');
    });

    it('nieznana wartosc ?szablon= daje domyslny szablon (Galeria)', async () => {
        await renderPage({ szablon: 'nieznany' });

        expect(currentTemplate()).toHaveTextContent('Galeria');
    });

    it('bez platnosci online CTA prowadzi do kontaktu z tematem premium, bez slugu firmy', async () => {
        await renderPage({});

        expect(screen.getByRole('link', { name: 'Chcę taką stronę' })).toHaveAttribute(
            'href',
            '/contact?topic=premium',
        );
    });
});
