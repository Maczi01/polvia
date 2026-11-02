import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { ProfileBreadcrumb } from '@/lib/service-profile-breadcrumbs';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileBreadcrumbs } from './profile-breadcrumbs';

expect.extend(toHaveNoViolations);

const WITH_CITY: ProfileBreadcrumb[] = [
    { label: 'Polvia', href: '/' },
    { label: 'Zdrowie', href: '/mapa/zdrowie' },
    { label: 'Warszawa', href: '/mapa/zdrowie/warszawa' },
    { label: 'Twój Lekarz', href: '/firma/twoj-lekarz-warszawa' },
];

describe('ProfileBreadcrumbs', () => {
    it('z miastem: nawigacja z lista, linki do mapy i biezaca strona jako tekst', async () => {
        const { container } = renderWithIntl(<ProfileBreadcrumbs items={WITH_CITY} />);

        const nav = screen.getByRole('navigation', { name: 'Ścieżka nawigacji' });
        const items = within(nav).getAllByRole('listitem');
        expect(items).toHaveLength(4);
        expect(screen.getByRole('link', { name: 'Polvia' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Zdrowie' })).toHaveAttribute(
            'href',
            '/mapa/zdrowie',
        );
        expect(screen.getByRole('link', { name: 'Warszawa' })).toHaveAttribute(
            'href',
            '/mapa/zdrowie/warszawa',
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('ostatnia pozycja ma aria-current="page" i nie jest linkiem', () => {
        renderWithIntl(<ProfileBreadcrumbs items={WITH_CITY} />);

        const current = screen.getByText('Twój Lekarz');
        expect(current).toHaveAttribute('aria-current', 'page');
        expect(screen.queryByRole('link', { name: 'Twój Lekarz' })).not.toBeInTheDocument();
    });

    it('bez miasta: trzy pozycje', async () => {
        const { container } = renderWithIntl(
            <ProfileBreadcrumbs
                items={[
                    { label: 'Polvia', href: '/' },
                    { label: 'Finansowe', href: '/mapa/finansowe' },
                    { label: 'Taxovia', href: '/firma/taxovia' },
                ]}
            />,
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(3);
        expect(screen.getAllByRole('link')).toHaveLength(2);
        expect(await axe(container)).toHaveNoViolations();
    });

    it('pozycja bez sciezki to tekst (przyklad z fikcyjna firma)', () => {
        renderWithIntl(
            <ProfileBreadcrumbs
                items={[
                    { label: 'Polvia', href: '/' },
                    { label: 'Finansowe', href: null },
                    { label: 'Kolumna', href: null },
                ]}
            />,
        );

        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.getByText('Finansowe').closest('a')).toBeNull();
    });

    it('pusta lista nic nie renderuje', () => {
        const { container } = renderWithIntl(<ProfileBreadcrumbs items={[]} />);

        expect(container).toBeEmptyDOMElement();
    });
});
