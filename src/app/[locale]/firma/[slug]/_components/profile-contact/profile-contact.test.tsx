import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { makeLocation } from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { ProfileContact } from './profile-contact';

expect.extend(toHaveNoViolations);

describe('ProfileContact', () => {
    it('pokazuje telefon, e-mail, WWW i social media z nazwami dostepnymi', async () => {
        const { container } = renderWithIntl(
            <ProfileContact location={makeLocation()} showActions={false} showNavigate />,
        );

        const section = screen.getByRole('region', { name: 'Kontakt' });
        expect(within(section).getByRole('link', { name: 'Telefon: +48 600 100 200' })).toHaveAttribute(
            'href',
            'tel:+48 600 100 200',
        );
        expect(
            within(section).getByRole('link', { name: 'E-mail: biuro@mistrzremontu.pl' }),
        ).toHaveAttribute('href', 'mailto:biuro@mistrzremontu.pl');
        expect(
            within(section).getByRole('link', { name: 'Strona www: mistrzremontu.pl' }),
        ).toHaveAttribute('href', 'https://www.mistrzremontu.pl');
        const socials = within(section).getByRole('list', { name: 'Media społecznościowe' });
        expect(within(socials).getAllByRole('link').map(link => link.getAttribute('aria-label'))).toEqual(
            ['Facebook', 'Instagram', 'TikTok'],
        );
        expect(within(section).queryByRole('link', { name: 'Zadzwoń' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('z showActions dokleja przyciski akcji', () => {
        renderWithIntl(<ProfileContact location={makeLocation()} showActions showNavigate />);

        expect(screen.getByRole('link', { name: 'Zadzwoń' })).toBeInTheDocument();
    });

    it('bez danych kontaktowych nie renderuje sekcji', () => {
        const location = makeLocation({
            phoneNumber: null,
            email: null,
            webpage: null,
            socials: null,
            whatsappNumber: null,
        });
        renderWithIntl(<ProfileContact location={location} showActions={false} showNavigate />);

        expect(screen.queryByRole('region', { name: 'Kontakt' })).not.toBeInTheDocument();
    });
});
