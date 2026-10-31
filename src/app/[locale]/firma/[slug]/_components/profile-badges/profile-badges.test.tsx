import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileBadges } from './profile-badges';

expect.extend(toHaveNoViolations);

describe('ProfileBadges', () => {
    it('pokazuje przetlumaczona kategorie, zasieg online i weryfikacje', async () => {
        const { container } = renderWithIntl(
            <ProfileBadges category="financial" coverage="online" verified />,
        );

        expect(screen.getByText('Finansowe')).toBeInTheDocument();
        expect(screen.getByText('Online')).toBeInTheDocument();
        expect(screen.getByText('Zweryfikowano')).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('zasieg lokalny i brak weryfikacji nie maja etykiet', () => {
        renderWithIntl(<ProfileBadges category="renovation" coverage="local" verified={false} />);

        expect(screen.getAllByRole('listitem')).toHaveLength(1);
        expect(screen.getByText('Remonty')).toBeInTheDocument();
    });

    it('nieznana kategoria dostaje etykiete "Inne"', () => {
        renderWithIntl(<ProfileBadges category="unknown" coverage="hybrid" verified={false} />);

        expect(screen.getByText('Inne')).toBeInTheDocument();
        expect(screen.getByText('Na miejscu i online')).toBeInTheDocument();
    });
});
