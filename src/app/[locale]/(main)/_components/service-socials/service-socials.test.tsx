import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ServiceSocials } from './service-socials';

expect.extend(toHaveNoViolations);

const IKONASTONE_SOCIALS = {
    facebook: 'https://www.facebook.com/ikonastone',
    instagram: 'https://www.instagram.com/ikonastone/',
    youtube: 'https://www.youtube.com/@ikonastone',
    threads: 'https://www.threads.com/@ikonastone',
    viber: 'https://invite.viber.com/?g2=abc',
    telegram: 'https://t.me/ikonastone',
};

describe('<ServiceSocials />', () => {
    // Regresja: YouTube i Viber byly w bazie, ale karta ich nie rysowala.
    it.each([
        ['youtube', 'YouTube', 'https://www.youtube.com/@ikonastone'],
        ['viber', 'Viber', 'https://invite.viber.com/?g2=abc'],
        ['threads', 'Threads', 'https://www.threads.com/@ikonastone'],
    ])('pokazuje %s, gdy jest jedyna siecia wpisu', (key, label, href) => {
        render(<ServiceSocials socials={{ [key]: href }} />);

        expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    });

    it('rysuje sieci w stalej kolejnosci i pomija Telegrama', () => {
        render(<ServiceSocials socials={IKONASTONE_SOCIALS} />);

        const labels = screen.getAllByRole('link').map(link => link.getAttribute('aria-label'));
        expect(labels).toEqual(['Facebook', 'Instagram', 'YouTube', 'Threads', 'Viber']);
    });

    it('otwiera linki w nowej karcie', () => {
        render(<ServiceSocials socials={{ threads: IKONASTONE_SOCIALS.threads }} />);

        const link = screen.getByRole('link', { name: 'Threads' });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('nie renderuje niczego, gdy wpis nie ma sieci do pokazania', () => {
        const { container } = render(
            <ServiceSocials socials={{ telegram: IKONASTONE_SOCIALS.telegram }} />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('nie renderuje niczego, gdy socials jest null', () => {
        const { container } = render(<ServiceSocials socials={null} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('przechodzi asercje jest-axe', async () => {
        const { container } = render(<ServiceSocials socials={IKONASTONE_SOCIALS} />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
