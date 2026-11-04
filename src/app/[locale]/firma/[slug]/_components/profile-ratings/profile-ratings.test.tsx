import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import type { ProfileRating } from '../service-profile-types';
import { ProfileRatings } from './profile-ratings';

expect.extend(toHaveNoViolations);

const RATINGS: ProfileRating[] = [
    { source: 'google', name: 'Google', rating: 4.8, count: 120, url: 'https://g.example.com/x' },
    { source: 'booksy', name: 'Booksy', rating: 5, count: 1, url: 'https://booksy.example.com/x' },
    { source: 'other', name: 'Oferteo', rating: 4.25, count: 1234, url: 'https://o.example.com' },
];

describe('ProfileRatings', () => {
    it('renderuje plakietki z dostepna nazwa: serwis, ocena po polsku, liczba opinii', async () => {
        const { container } = renderWithIntl(<ProfileRatings ratings={RATINGS} />);

        const section = screen.getByRole('region', { name: 'Opinie w innych serwisach' });
        const links = within(section).getAllByRole('link');
        expect(links.map(link => link.getAttribute('aria-label'))).toEqual([
            'Google: 4,8 na 5, 120 opinii (otwiera się w nowej karcie)',
            'Booksy: 5,0 na 5, 1 opinia (otwiera się w nowej karcie)',
            'Oferteo: 4,3 na 5, 1234 opinie (otwiera się w nowej karcie)',
        ]);
        expect(within(links[0]).getByText('4,8')).toBeInTheDocument();
        expect(within(links[0]).getByText('120 opinii')).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('link prowadzi do zrodla w nowej karcie, bez dostepu do window.opener', () => {
        renderWithIntl(<ProfileRatings ratings={RATINGS.slice(0, 1)} />);

        const link = screen.getByRole('link', { name: /^Google: 4,8 na 5/ });
        expect(link).toHaveAttribute('href', 'https://g.example.com/x');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('gwiazdki oddaja ulamek oceny: 4,8 to cztery pelne i piata w 80%', () => {
        renderWithIntl(<ProfileRatings ratings={RATINGS.slice(0, 1)} />);

        const link = screen.getByRole('link', { name: /^Google/ });
        const widths = within(link)
            .getAllByTestId('rating-star-fill')
            .map(fill => fill.style.width);
        expect(widths).toEqual(['100%', '100%', '100%', '100%', '80%']);
    });

    it('bez ocen nie renderuje sekcji', () => {
        const { container } = renderWithIntl(<ProfileRatings ratings={[]} />);

        expect(screen.queryByRole('region')).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });
});
