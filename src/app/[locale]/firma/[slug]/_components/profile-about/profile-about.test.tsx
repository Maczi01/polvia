import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileAbout } from './profile-about';

expect.extend(toHaveNoViolations);

describe('ProfileAbout', () => {
    it('pokazuje opis, jezyki i specjalizacje w sekcji "O firmie"', async () => {
        const { container } = renderWithIntl(
            <ProfileAbout
                description="Remonty mieszkań w Warszawie."
                languages={['pl']}
                tags={['Łazienki', 'Glazura']}
            />,
        );

        const section = screen.getByRole('region', { name: 'O firmie' });
        expect(within(section).getByText('Remonty mieszkań w Warszawie.')).toBeInTheDocument();
        expect(within(section).getByText('polski')).toBeInTheDocument();
        expect(within(section).getByText('Łazienki')).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bez opisu, jezykow i tagow nie renderuje pustej sekcji', () => {
        renderWithIntl(<ProfileAbout description={null} languages={[]} tags={[]} />);

        expect(screen.queryByRole('region', { name: 'O firmie' })).not.toBeInTheDocument();
    });
});
