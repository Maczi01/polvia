import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileFaq } from './profile-faq';

expect.extend(toHaveNoViolations);

const ITEMS = [
    { question: 'Ile trwa remont łazienki?', answer: 'Od 10 do 14 dni roboczych.' },
    { question: 'Czy dajecie gwarancję?', answer: 'Tak, na 24 miesiące.' },
];

describe('ProfileFaq', () => {
    it('kazde pytanie to zwiniety element <details> z odpowiedzia w HTML', async () => {
        const { container } = renderWithIntl(<ProfileFaq items={ITEMS} />);

        expect(screen.getByRole('region', { name: 'Najczęstsze pytania' })).toBeInTheDocument();
        const details = container.querySelectorAll('details');
        expect(details).toHaveLength(2);
        details.forEach(item => expect(item).not.toHaveAttribute('open'));
        expect(screen.getByText('Tak, na 24 miesiące.')).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    // Aktywacje `summary` Enterem/Spacja daje przegladarka; user-event nie uznaje
    // `summary` za cel Tab, wiec fokus sprawdzamy przez `focus()`.
    it('pytanie przyjmuje fokus i rozwija sie po aktywacji', async () => {
        const user = userEvent.setup();
        const { container } = renderWithIntl(<ProfileFaq items={ITEMS} />);
        const [first] = container.querySelectorAll('details');

        const summary = screen.getByText('Ile trwa remont łazienki?');
        summary.focus();
        expect(summary).toHaveFocus();

        await user.click(summary);
        expect(first).toHaveAttribute('open');
    });

    it('bez pytan nie renderuje sekcji', () => {
        renderWithIntl(<ProfileFaq items={[]} />);

        expect(screen.queryByRole('region', { name: 'Najczęstsze pytania' })).not.toBeInTheDocument();
    });
});
