import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import {
    chainServiceFixture,
    localServiceFixture,
    makeLocation,
    onlineServiceFixture,
} from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { ProfileLocations } from './profile-locations';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('ProfileLocations', () => {
    it('kilka adresow: grupy miast, glowny pierwszy, adres w jednej linii i link do mapy', async () => {
        const { container } = renderWithIntl(<ProfileLocations profile={localServiceFixture} />);

        const section = screen.getByRole('region', { name: 'Lokalizacje' });
        const cities = within(section).getAllByRole('heading', { level: 3 });
        expect(cities.map(heading => heading.textContent)).toEqual(['Warszawa', 'Piaseczno']);
        const addresses = within(section).getAllByRole('listitem');
        expect(addresses).toHaveLength(2);
        expect(addresses[0]).toHaveTextContent('Siedziba główna');
        expect(addresses[0]).toHaveTextContent('ul. Grochowska 278, 03-841');
        expect(addresses[0]).not.toHaveTextContent('Mazowieckie');
        expect(addresses[1]).toHaveTextContent('ul. Puławska 42, 05-500');
        expect(within(addresses[1]).getByRole('link', { name: '+48 600 300 400' })).toHaveAttribute(
            'href',
            'tel:+48 600 300 400',
        );
        expect(within(section).queryByText(/Pokaż pozostałe/)).not.toBeInTheDocument();
        expect(within(section).getByRole('link', { name: 'Pokaż na mapie' })).toHaveAttribute(
            'href',
            '/map',
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('ponad 4 adresy: widoczne cale miasta do limitu, reszta zwinieta w <details>', async () => {
        const { container } = renderWithIntl(<ProfileLocations profile={chainServiceFixture} />);

        const section = screen.getByRole('region', { name: 'Lokalizacje' });
        const summary = within(section).getByText(
            'Pokaż pozostałe 5 lokalizacji (Bydgoszcz, Chojnice, Szczecin, Wrocław)',
        );
        const details = summary.closest('details');
        expect(details).not.toBeNull();
        expect(details).not.toHaveAttribute('open');

        const visibleCities = within(section)
            .getAllByRole('heading', { level: 3 })
            .filter(heading => !details?.contains(heading));
        expect(visibleCities.map(heading => heading.textContent)).toEqual(['Poznań (3)']);
        // Zwiniete adresy zostaja w HTML (SEO), choc niewidoczne do rozwiniecia.
        expect(details).toHaveTextContent('Bydgoszcz (2)');
        expect(details).toHaveTextContent('ul. Kościerska 9, 89-600');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('podsumowanie jest natywnym <summary> i rozwija zwiniete adresy', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ProfileLocations profile={chainServiceFixture} />);

        // jsdom nie umieszcza <summary> w kolejnosci Tab — fokus z klawiatury daje przegladarka
        // dla pierwszego dziecka <details>; tu sprawdzamy strukture i przelaczanie.
        const summary = screen.getByText(/^Pokaż pozostałe/);
        const details = summary.closest('details');
        expect(summary.tagName).toBe('SUMMARY');
        expect(details?.firstElementChild).toBe(summary);
        await user.click(summary);

        expect(details).toHaveAttribute('open');
    });

    it('etykieta siedziby tylko przy glownym adresie, telefon tylko przy pozostalych', () => {
        renderWithIntl(<ProfileLocations profile={chainServiceFixture} />);

        const section = screen.getByRole('region', { name: 'Lokalizacje' });
        const addresses = within(section).getAllByRole('listitem');
        expect(addresses).toHaveLength(8);
        expect(within(section).getAllByText('Siedziba główna')).toHaveLength(1);
        expect(addresses[0]).toHaveTextContent('Siedziba główna');
        expect(within(addresses[0]).queryByRole('link')).not.toBeInTheDocument();
        expect(within(addresses[1]).getByRole('link')).toHaveAttribute(
            'href',
            'tel:+48 600 100 003',
        );
    });

    it('jedno miasto: naglowek miasta z liczba, bez zwijania', () => {
        renderWithIntl(
            <ProfileLocations
                profile={{
                    ...localServiceFixture,
                    locations: [
                        makeLocation(),
                        makeLocation({
                            id: 'loc-2',
                            street: 'ul. Prosta 1',
                            isMainLocation: false,
                        }),
                    ],
                }}
            />,
        );

        expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Warszawa (2)');
        expect(screen.queryByText(/Pokaż pozostałe/)).not.toBeInTheDocument();
    });

    it('jeden adres: wyglad bez zmian — "Adres", pelny adres z wojewodztwem, bez grup', async () => {
        const { container } = renderWithIntl(
            <ProfileLocations profile={{ ...localServiceFixture, locations: [makeLocation()] }} />,
        );

        const section = screen.getByRole('region', { name: 'Adres' });
        expect(within(section).queryByText('Siedziba główna')).not.toBeInTheDocument();
        expect(within(section).queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
        const address = within(section).getByRole('listitem');
        expect(address).toHaveTextContent('ul. Grochowska 278');
        expect(address).toHaveTextContent('03-841 Warszawa');
        expect(address).toHaveTextContent('Mazowieckie');
        expect(within(address).queryByRole('link')).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
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
