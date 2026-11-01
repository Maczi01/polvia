import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ProfileSection } from './profile-section';

expect.extend(toHaveNoViolations);

describe('ProfileSection', () => {
    it('jest regionem nazwanym swoim naglowkiem h2', async () => {
        const { container } = render(
            <ProfileSection id="hours" title="Godziny otwarcia">
                <p>Tresc</p>
            </ProfileSection>,
        );

        const region = screen.getByRole('region', { name: 'Godziny otwarcia' });
        expect(region).toHaveAttribute('id', 'hours');
        expect(screen.getByRole('heading', { level: 2, name: 'Godziny otwarcia' })).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('className szablonu nadpisuje domyslna ramke', () => {
        render(
            <ProfileSection id="faq" title="FAQ" className="rounded-none border-0">
                <p>Tresc</p>
            </ProfileSection>,
        );

        const region = screen.getByRole('region', { name: 'FAQ' });
        expect(region).toHaveClass('rounded-none', 'border-0');
        expect(region).not.toHaveClass('rounded-2xl');
    });
});
