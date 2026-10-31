import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { localServiceFixture } from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { SimilarServices } from './similar-services';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('SimilarServices', () => {
    it('kazda podobna firma to link z nazwa, miastem i kategoria', async () => {
        const { container } = renderWithIntl(
            <SimilarServices services={localServiceFixture.similarServices} />,
        );

        const section = screen.getByRole('region', { name: 'Podobne firmy' });
        const links = within(section).getAllByRole('link');
        expect(links).toHaveLength(4);
        expect(links[0]).toHaveTextContent('Liga Remontu');
        expect(links[0]).toHaveTextContent('Warszawa');
        expect(links[0]).toHaveTextContent('Remonty');
        expect(links[0]).toHaveAttribute('href', '/map');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bez podobnych firm nie renderuje sekcji', () => {
        renderWithIntl(<SimilarServices services={[]} />);

        expect(screen.queryByRole('region', { name: 'Podobne firmy' })).not.toBeInTheDocument();
    });
});
