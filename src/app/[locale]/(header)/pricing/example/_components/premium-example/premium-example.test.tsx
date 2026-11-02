import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';

import { renderWithIntl } from '@/app/[locale]/firma/[slug]/_components/profile-test-utils';

import { getPremiumExampleProfile } from '../premium-example-profile';
import { PremiumExample } from './premium-example';

expect.extend(toHaveNoViolations);

type MockHref = string | { pathname: string; query?: Record<string, string> };

function hrefToUrl(href: MockHref): string {
    if (typeof href === 'string') return href;
    const query = new URLSearchParams(href.query).toString();
    return query === '' ? href.pathname : `${href.pathname}?${query}`;
}

/** Routing next-intl ciagnie App Router — link renderuje sciezke wewnetrzna z query. */
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

const CONTACT_HREF = { pathname: '/contact', query: { topic: 'premium' } } as const;

function switcher(): HTMLElement {
    return screen.getByRole('navigation', { name: 'Szablon strony' });
}

describe('PremiumExample', () => {
    it('oznacza przyklad, ma CTA zakupu i renderuje wybrany szablon; przechodzi jest-axe', async () => {
        const { container } = renderWithIntl(
            <PremiumExample
                profile={getPremiumExampleProfile('pl', 'professional')}
                ctaHref={CONTACT_HREF}
            />,
        );

        const banner = screen.getByRole('region', {
            name: 'Tak może wyglądać strona Twojej firmy',
        });
        expect(within(banner).getByText(/są fikcyjne/)).toBeInTheDocument();
        expect(within(banner).getByRole('link', { name: 'Chcę taką stronę' })).toHaveAttribute(
            'href',
            '/contact?topic=premium',
        );
        expect(
            screen.getByRole('heading', { level: 1, name: 'Kolumna — biuro rachunkowe' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Opinie w innych serwisach' }),
        ).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('przelacznik: trzy linki ?szablon=, aria-current tylko na biezacym', () => {
        renderWithIntl(
            <PremiumExample
                profile={getPremiumExampleProfile('pl', 'classic')}
                ctaHref="/pricing"
            />,
        );

        const links = within(switcher()).getAllByRole('link');
        expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
            ['Galeria', '/pricing/example?szablon=gallery'],
            ['Profesjonalny', '/pricing/example?szablon=professional'],
            ['Klasyczny', '/pricing/example?szablon=classic'],
        ]);
        expect(within(switcher()).getByRole('link', { current: 'page' })).toHaveTextContent(
            'Klasyczny',
        );
        expect(links.filter(link => link.hasAttribute('aria-current'))).toHaveLength(1);
    });

    it.each([
        ['gallery', 'Galeria'],
        ['professional', 'Profesjonalny'],
    ] as const)('szablon %s: biezacy w przelaczniku', (template, label) => {
        renderWithIntl(
            <PremiumExample
                profile={getPremiumExampleProfile('pl', template)}
                ctaHref="/pricing"
            />,
        );

        expect(within(switcher()).getByRole('link', { current: 'page' })).toHaveTextContent(label);
    });
});
