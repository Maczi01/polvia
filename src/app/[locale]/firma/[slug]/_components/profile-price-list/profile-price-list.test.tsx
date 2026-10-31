import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfilePriceList } from './profile-price-list';

expect.extend(toHaveNoViolations);

describe('ProfilePriceList', () => {
    it('renderuje pozycje w kolejnosci z danych, z cena jako tekstem', async () => {
        const { container } = renderWithIntl(
            <ProfilePriceList
                items={[
                    { name: 'Układanie płytek', price: 'od 120 zł/m²' },
                    { name: 'Wycena', price: 'bezpłatnie', note: 'Na miejscu' },
                    { name: 'Malowanie', price: '25 zł/m²' },
                ]}
            />,
        );

        const section = screen.getByRole('region', { name: 'Cennik usług' });
        const rows = within(section).getAllByRole('listitem');
        expect(rows.map(row => row.querySelector('p')?.textContent)).toEqual([
            'Układanie płytek',
            'Wycena',
            'Malowanie',
        ]);
        expect(rows[0]).toHaveTextContent('od 120 zł/m²');
        expect(rows[1]).toHaveTextContent('bezpłatnie');
        expect(within(rows[1]).getByText('Na miejscu')).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('pusty cennik nie renderuje sekcji', () => {
        renderWithIntl(<ProfilePriceList items={[]} />);

        expect(screen.queryByRole('region', { name: 'Cennik usług' })).not.toBeInTheDocument();
    });
});
