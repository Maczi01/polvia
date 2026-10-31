import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { makeLocation } from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { ProfileActions } from './profile-actions';

expect.extend(toHaveNoViolations);

describe('ProfileActions', () => {
    it('renderuje telefon, WhatsApp, Telegram i nawigacje jako linki', async () => {
        const { container } = renderWithIntl(
            <ProfileActions location={makeLocation()} showNavigate />,
        );

        expect(screen.getByRole('link', { name: 'Zadzwoń' })).toHaveAttribute(
            'href',
            'tel:+48 600 100 200',
        );
        expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
            'href',
            'https://wa.me/48600100200',
        );
        expect(screen.getByRole('link', { name: 'Telegram' })).toHaveAttribute(
            'href',
            'https://t.me/mistrzremontu',
        );
        const navigate = screen.getByRole('link', { name: 'Nawiguj' });
        expect(navigate).toHaveAttribute('target', '_blank');
        expect(navigate).toHaveAttribute('rel', 'noopener noreferrer');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bez punktu obslugi nie pokazuje nawigacji', () => {
        renderWithIntl(<ProfileActions location={makeLocation()} showNavigate={false} />);

        expect(screen.queryByRole('link', { name: 'Nawiguj' })).not.toBeInTheDocument();
    });

    it('bez zadnego kanalu nie renderuje pustej listy', () => {
        const location = makeLocation({
            phoneNumber: null,
            whatsappNumber: null,
            socials: null,
            latitude: null,
            longitude: null,
        });
        const { container } = renderWithIntl(<ProfileActions location={location} showNavigate />);

        expect(container).toBeEmptyDOMElement();
    });
});
