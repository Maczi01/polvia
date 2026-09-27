import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ButtonCategory } from './button-category';

expect.extend(toHaveNoViolations);

function ToggleCategory() {
    const [isSelected, setIsSelected] = useState(false);
    return (
        <ButtonCategory
            text="Uroda"
            image="/icons/beauty.svg"
            count={8}
            isSelected={isSelected}
            onClick={() => setIsSelected(previous => !previous)}
        />
    );
}

describe('<ButtonCategory />', () => {
    it('liczba wynikow jest czescia dostepnej nazwy przycisku', () => {
        render(<ButtonCategory text="Uroda" image="/icons/beauty.svg" count={8} />);

        expect(screen.getByRole('button', { name: 'Uroda (8)' })).toBeInTheDocument();
    });

    it('zero tez jest pokazywane, a przycisk zostaje aktywny', () => {
        render(<ButtonCategory text="Urzędowe" image="/icons/gov.svg" count={0} />);

        const button = screen.getByRole('button', { name: 'Urzędowe (0)' });
        expect(button).toBeEnabled();
    });

    it('bez liczby nazwa to sam tekst — ikona jest dekoracyjna', () => {
        render(<ButtonCategory text="Online" image="/icons/online.svg" />);

        expect(screen.getByRole('button', { name: 'Online' })).toBeInTheDocument();
    });

    it('aria-pressed podaza za zaznaczeniem przy klikaniu', async () => {
        render(<ToggleCategory />);
        const button = screen.getByRole('button', { name: 'Uroda (8)' });

        expect(button).toHaveAttribute('aria-pressed', 'false');
        await userEvent.click(button);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(button);
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('bez isSelected to zwykly przycisk, nie przelacznik', () => {
        render(<ButtonCategory text="Usuń filtry" image="/icons/remove.svg" />);

        expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = render(<ToggleCategory />);

        expect(await axe(container)).toHaveNoViolations();
    });
});
