import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { localServiceFixture, makeLocation, onlineServiceFixture } from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { ProfileLocations } from './profile-locations';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('ProfileLocations', () => {
    it('pokazuje wszystkie adresy, glowny pierwszy, i link do mapy', async () => {
        const { container } = renderWithIntl(<ProfileLocations profile={localServiceFixture} />);

        const section = screen.getByRole('region', { name: 'Lokalizacje' });
        const addresses = within(section).getAllByRole('listitem');
        expect(addresses).toHaveLength(2);
        expect(addresses[0]).toHaveTextContent('Siedziba główna');
        expect(addresses[0]).toHaveTextContent('ul. Grochowska 278');
        expect(addresses[0]).toHaveTextContent('03-841 Warszawa');
        expect(addresses[0]).toHaveTextContent('Mazowieckie');
        expect(addresses[1]).toHaveTextContent('Piaseczno');
        expect(within(section).getByRole('link', { name: 'Pokaż na mapie' })).toHaveAttribute(
            'href',
            '/map',
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('jeden adres ma naglowek "Adres" bez etykiety siedziby', () => {
        renderWithIntl(
            <ProfileLocations profile={{ ...localServiceFixture, locations: [makeLocation()] }} />,
        );

        const section = screen.getByRole('region', { name: 'Adres' });
        expect(within(section).queryByText('Siedziba główna')).not.toBeInTheDocument();
    });

    it('wpis online: informacja o obsludze zdalnej zamiast adresu i mapy', () => {
        renderWithIntl(<ProfileLocations profile={onlineServiceFixture} />);

        expect(screen.getByText(/wyłącznie zdalnie/)).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: /Adres|Lokalizacje/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Pokaż na mapie' })).not.toBeInTheDocument();
    });

    it('wpis lokalny bez lokalizacji nie renderuje niczego', () => {
        const { container } = renderWithIntl(
            <ProfileLocations profile={{ ...localServiceFixture, locations: [] }} />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
