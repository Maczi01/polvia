import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileHours } from './profile-hours';

expect.extend(toHaveNoViolations);

describe('ProfileHours', () => {
    it('pokazuje caly tydzien od poniedzialku, a dzien bez godzin jako zamkniety', async () => {
        const { container } = renderWithIntl(
            <ProfileHours
                openingHours={{
                    monday: { open: '08:00', close: '18:00' },
                    saturday: { open: '09:00', close: '13:00' },
                }}
            />,
        );

        const section = screen.getByRole('region', { name: 'Godziny otwarcia' });
        const days = within(section).getAllByRole('term').map(term => term.textContent);
        expect(days).toEqual([
            'Poniedziałek',
            'Wtorek',
            'Środa',
            'Czwartek',
            'Piątek',
            'Sobota',
            'Niedziela',
        ]);
        const hours = within(section).getAllByRole('definition').map(cell => cell.textContent);
        expect(hours[0]).toBe('08:00 – 18:00');
        expect(hours[5]).toBe('09:00 – 13:00');
        expect(hours[6]).toBe('Zamknięte');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('firma z kilkoma adresami: tytul mowi, ze godziny dotycza siedziby glownej', () => {
        renderWithIntl(
            <ProfileHours
                openingHours={{ monday: { open: '08:00', close: '18:00' } }}
                isMainLocationOnly
            />,
        );

        expect(
            screen.getByRole('region', { name: 'Godziny otwarcia — siedziba główna' }),
        ).toBeInTheDocument();
    });

    it('bez godzin nie renderuje sekcji', () => {
        renderWithIntl(<ProfileHours openingHours={{}} />);

        expect(screen.queryByRole('region', { name: 'Godziny otwarcia' })).not.toBeInTheDocument();
    });
});
