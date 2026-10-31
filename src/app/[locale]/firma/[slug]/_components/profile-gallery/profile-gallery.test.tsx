import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { premiumServiceFixture } from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { ProfileGallery } from './profile-gallery';

expect.extend(toHaveNoViolations);

const IMAGES = premiumServiceFixture.premium?.gallery ?? [];

// jsdom 20 nie implementuje trybu modalnego <dialog> — API przegladarki, nie testowany kod.
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
    };
});

describe('ProfileGallery', () => {
    it('kazda miniatura to przycisk z opisem zdjecia i pozycja', async () => {
        const { container } = renderWithIntl(<ProfileGallery images={IMAGES} layout="mosaic" />);

        const section = screen.getByRole('region', { name: 'Galeria' });
        const buttons = within(section).getAllByRole('button', { name: /^Powiększ zdjęcie/ });
        expect(buttons).toHaveLength(12);
        expect(buttons[0]).toHaveAccessibleName('Powiększ zdjęcie 1 z 12: Realizacja remontu 1');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('otwiera podglad, przewija do nastepnego zdjecia i zamyka', async () => {
        const user = userEvent.setup();
        renderWithIntl(<ProfileGallery images={IMAGES} layout="grid" />);

        await user.click(screen.getByRole('button', { name: /^Powiększ zdjęcie 2 z 12/ }));
        const dialog = screen.getByRole('dialog', { name: 'Podgląd zdjęcia' });
        expect(within(dialog).getByText('2 z 12')).toBeInTheDocument();
        expect(within(dialog).getByRole('img', { name: 'Realizacja remontu 2' })).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Następne zdjęcie' }));
        expect(within(dialog).getByText('3 z 12')).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Poprzednie zdjęcie' }));
        await user.click(within(dialog).getByRole('button', { name: 'Poprzednie zdjęcie' }));
        await user.click(within(dialog).getByRole('button', { name: 'Poprzednie zdjęcie' }));
        expect(within(dialog).getByText('12 z 12')).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Zamknij podgląd' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('z limitem podgladu pokazuje licznik pozostalych na ostatniej miniaturze', () => {
        renderWithIntl(<ProfileGallery images={IMAGES} layout="grid" previewLimit={6} />);

        expect(screen.getAllByRole('button', { name: /^Powiększ zdjęcie/ })).toHaveLength(6);
        expect(screen.getByText('+6')).toBeInTheDocument();
    });

    it('bez zdjec nie renderuje pustej sekcji', () => {
        renderWithIntl(<ProfileGallery images={[]} layout="mosaic" />);

        expect(screen.queryByRole('region', { name: 'Galeria' })).not.toBeInTheDocument();
    });
});
