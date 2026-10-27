import { render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { PopularServicesGridClient } from './popular-services-card';
import type { HomepageService } from '@/lib/queries';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna. Mock zwraca sam klucz.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

// Link z @/i18n/navigation ciagnie routing next-intl (ESM w tescie).
jest.mock('@/i18n/navigation', () => ({
    Link: ({
        href,
        children,
        ...rest
    }: {
        href: string | { pathname: string; query: Record<string, string> };
        children: React.ReactNode;
    }) => (
        <a
            href={
                typeof href === 'string'
                    ? href
                    : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
            }
            {...rest}
        >
            {children}
        </a>
    ),
}));

function service(index: number): HomepageService {
    return {
        serviceId: `id-${index}`,
        slug: `firma-${index}-warszawa`,
        name: `Firma ${index}`,
        category: 'law',
        image: null,
    };
}

const POPULAR = [service(1), service(2)];
const NEWEST = [service(3)];

function listUnder(headingKey: string): HTMLElement {
    const heading = screen.getByRole('heading', { name: headingKey });
    const group = heading.closest('[role="group"]');
    if (!(group instanceof HTMLElement)) throw new Error(`brak grupy dla ${headingKey}`);
    return group;
}

describe('<PopularServicesGridClient />', () => {
    it('pokazuje popularne i ostatnio dodane jako osobne listy', () => {
        render(<PopularServicesGridClient popular={POPULAR} newest={NEWEST} />);

        const popular = listUnder('popularCompanies');
        const newest = listUnder('recentlyAdded');

        expect(within(popular).getAllByRole('link')).toHaveLength(2);
        expect(within(popular).getByText('Firma 1')).toBeInTheDocument();
        expect(within(newest).getAllByRole('link')).toHaveLength(1);
        expect(within(newest).getByText('Firma 3')).toBeInTheDocument();
    });

    it('karta otwiera firme na mapie przez parametr place', () => {
        render(<PopularServicesGridClient popular={POPULAR} newest={[]} />);

        const card = within(listUnder('popularCompanies')).getAllByRole('link')[0];

        expect(card).toHaveAttribute('href', '/map?place=firma-1-warszawa');
    });

    it('pusta lista nie zostawia samego naglowka', () => {
        render(<PopularServicesGridClient popular={POPULAR} newest={[]} />);

        expect(screen.queryByRole('heading', { name: 'recentlyAdded' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'popularCompanies' })).toBeInTheDocument();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = render(
            <PopularServicesGridClient popular={POPULAR} newest={NEWEST} />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
