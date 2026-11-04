import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import {
    localServiceFixture,
    makeLocation,
    onlineServiceFixture,
    premiumProfessionalFixture,
} from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { ProfileMap } from './profile-map';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

function mapImage(): HTMLElement {
    return screen.getByRole('img', { name: /^Mapa z lokalizacją firmy/ });
}

describe('ProfileMap', () => {
    it('kilka punktow: kadr auto ze wszystkimi pinami, obraz i przycisk linkuja do mapy; jest-axe', async () => {
        const { container } = renderWithIntl(<ProfileMap profile={localServiceFixture} />);

        const section = screen.getByRole('region', { name: 'Jak do nas trafić' });
        const image = within(section).getByRole('img', {
            name: 'Mapa z lokalizacją firmy Mistrz Remontu (Warszawa, Piaseczno)',
        });
        const src = image.getAttribute('src') ?? '';
        expect(src).toContain(
            '/static/pin-l+c52289(21.09270,52.24810),pin-l+c52289(21.02390,52.08140)/auto/1200x400@2x?',
        );
        expect(src).toContain('padding=60');
        expect(image.closest('a')).toHaveAttribute('href', '/map');
        expect(within(section).getByRole('link', { name: 'Pokaż na mapie' })).toHaveAttribute(
            'href',
            '/map',
        );
        expect(within(section).getByRole('link', { name: '© OpenStreetMap' })).toHaveAttribute(
            'href',
            'https://www.openstreetmap.org/copyright',
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it('jeden punkt: kadr wysrodkowany na pinie', () => {
        renderWithIntl(<ProfileMap profile={premiumProfessionalFixture} />);

        expect(mapImage().getAttribute('src')).toContain(
            '/static/pin-l+c52289(21.09270,52.24810)/21.09270,52.24810,15,0/1200x400@2x?',
        );
    });

    it('bez mapHref: obraz nie jest linkiem i nie ma przycisku mapy; jest-axe', async () => {
        const { container } = renderWithIntl(
            <ProfileMap profile={{ ...localServiceFixture, mapHref: null }} />,
        );

        expect(mapImage().closest('a')).toBeNull();
        expect(screen.queryByRole('link', { name: 'Pokaż na mapie' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('pomija punkty bez wspolrzednych; alt bez miasta, gdy zadne nie jest znane', () => {
        renderWithIntl(
            <ProfileMap
                profile={{
                    ...localServiceFixture,
                    locations: [
                        makeLocation({ city: null, latitude: 50.061_43, longitude: 19.936_58 }),
                        makeLocation({ id: 'loc-2', latitude: null, longitude: null }),
                    ],
                }}
            />,
        );

        const image = screen.getByRole('img', {
            name: 'Mapa z lokalizacją firmy Mistrz Remontu',
        });
        expect(image.getAttribute('src')).toContain('/19.93658,50.06143,15,0/');
    });

    it('wpis online: nic nie renderuje, nawet z zapomnianymi wspolrzednymi', () => {
        const { container } = renderWithIntl(
            <ProfileMap profile={{ ...onlineServiceFixture, locations: [makeLocation()] }} />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('zadna lokalizacja nie ma wspolrzednych: nic nie renderuje', () => {
        const { container } = renderWithIntl(
            <ProfileMap
                profile={{
                    ...localServiceFixture,
                    locations: [makeLocation({ latitude: null, longitude: null })],
                }}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
