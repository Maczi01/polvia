import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';

import { Link } from '@/i18n/navigation';

import { ServiceProfileLink } from './service-profile-link';

expect.extend(toHaveNoViolations);

/**
 * `prefetch` nie trafia do DOM, wiec sprawdzamy propsy przekazane do `Link`
 * z `@/i18n/navigation`. Sciezke po lokalizacji testuja `service-card.profile-link.test.tsx`
 * i `marker-popup.test.tsx` (prawdziwy routing).
 */
jest.mock('@/i18n/navigation', () => ({
    Link: jest.fn(({ children, className, onClick }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href="/firma/x" className={className} onClick={onClick}>
            {children}
        </a>
    )),
}));

const mockedLink = jest.mocked(Link);

describe('<ServiceProfileLink />', () => {
    beforeEach(() => {
        mockedLink.mockClear();
    });

    it('linkuje do /firma/[slug] bez prefetchu; przechodzi jest-axe', async () => {
        const { container } = render(
            <ServiceProfileLink slug="mistrz-remontu">Profil</ServiceProfileLink>,
        );

        expect(screen.getByRole('link', { name: 'Profil' })).toBeInTheDocument();
        expect(mockedLink.mock.calls[0][0]).toMatchObject({
            href: { pathname: '/firma/[slug]', params: { slug: 'mistrz-remontu' } },
            prefetch: false,
        });
        expect(await axe(container)).toHaveNoViolations();
    });

    it('ma kolor marki i dokleja klasy wywolujacego', () => {
        render(
            <ServiceProfileLink slug="x" className="mt-1 block text-sm">
                Profil
            </ServiceProfileLink>,
        );

        const link = screen.getByRole('link', { name: 'Profil' });
        expect(link).toHaveClass('text-brand', 'focus-visible:ring-brand', 'mt-1', 'block');
        expect(link.className).not.toContain('#C52289');
    });

    it('przekazuje onClick (karta zatrzymuje propagacje do rozwiniecia)', async () => {
        // preventDefault: jsdom nie implementuje nawigacji.
        const handleClick = jest.fn((event: MouseEvent<HTMLAnchorElement>) =>
            event.preventDefault(),
        );
        render(
            <ServiceProfileLink slug="x" onClick={handleClick}>
                Profil
            </ServiceProfileLink>,
        );

        await userEvent.click(screen.getByRole('link', { name: 'Profil' }));

        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
