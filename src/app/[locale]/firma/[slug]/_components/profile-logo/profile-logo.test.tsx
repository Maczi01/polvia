import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileLogo } from './profile-logo';

expect.extend(toHaveNoViolations);

describe('ProfileLogo', () => {
    it('ma tekst alternatywny z nazwa firmy', async () => {
        const { container } = renderWithIntl(
            <ProfileLogo name="Mistrz Remontu" logo="/services/remontyhlu.png" size={96} />,
        );

        const image = screen.getByRole('img', { name: 'Logo firmy Mistrz Remontu' });
        expect(image.getAttribute('src')).toContain(encodeURIComponent('/services/remontyhlu.png'));
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bez logo pokazuje zastepczy /default.png', () => {
        renderWithIntl(<ProfileLogo name="Bez Logo" logo={null} size={96} />);

        const image = screen.getByRole('img', { name: 'Logo firmy Bez Logo' });
        expect(image.getAttribute('src')).toContain(encodeURIComponent('/default.png'));
    });
});
