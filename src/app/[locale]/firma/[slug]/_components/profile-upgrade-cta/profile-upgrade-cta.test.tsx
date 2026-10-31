import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileUpgradeCta } from './profile-upgrade-cta';

expect.extend(toHaveNoViolations);

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('ProfileUpgradeCta', () => {
    it('jest linkiem "To moja firma — ulepsz stronę" pod href z propsa', async () => {
        const { container } = renderWithIntl(<ProfileUpgradeCta href="/pricing" />);

        expect(
            screen.getByRole('link', { name: 'To moja firma — ulepsz stronę' }),
        ).toHaveAttribute('href', '/pricing');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('wymienia korzysci premium z limitem galerii', () => {
        renderWithIntl(<ProfileUpgradeCta href="/pricing" />);

        const section = screen.getByRole('region', { name: 'To Twoja firma?' });
        expect(within(section).getAllByRole('listitem')).toHaveLength(3);
        expect(within(section).getByText(/galeria do 15 zdjęć/)).toBeInTheDocument();
    });
});
