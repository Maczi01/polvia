import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { CopyEmailButton } from './copy-email-button';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna — mock zwraca sam klucz, wiec asercje
// sprawdzaja zachowanie, nie tresc tlumaczen.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

const EMAIL = 'work-up@ukr.net';

/**
 * Schowek to API przegladarki, nie kod tego repo — mock jest tu uzasadniony.
 * jsdom nie ma `navigator.clipboard` wcale, wiec trzeba je dostawic.
 */
function mockClipboard(writeText: jest.Mock): void {
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
}

describe('<CopyEmailButton />', () => {
    it('renderuje przycisk z nazwa dostepna', () => {
        render(<CopyEmailButton email={EMAIL} />);

        expect(screen.getByRole('button', { name: 'copyEmail' })).toBeInTheDocument();
    });

    it('kopiuje adres do schowka i potwierdza to komunikatem', async () => {
        const writeText = jest.fn(async () => {});
        mockClipboard(writeText);

        render(<CopyEmailButton email={EMAIL} />);
        await userEvent.click(screen.getByRole('button', { name: 'copyEmail' }));

        expect(writeText).toHaveBeenCalledWith(EMAIL);
        expect(await screen.findByText('emailCopied')).toBeInTheDocument();
    });

    // Schowek jest niedostepny poza bezpiecznym kontekstem i da sie go zablokowac
    // polityka uprawnien. Przycisk nie moze wtedy klamac, ze skopiowal.
    it('pokazuje blad, gdy schowek odrzuci zapis', async () => {
        const writeText = jest.fn().mockRejectedValue(new Error('Denied'));
        mockClipboard(writeText);

        render(<CopyEmailButton email={EMAIL} />);
        await userEvent.click(screen.getByRole('button', { name: 'copyEmail' }));

        expect(await screen.findByText('emailCopyFailed')).toBeInTheDocument();
        expect(screen.queryByText('emailCopied')).not.toBeInTheDocument();
    });

    it('nie zglasza klikniecia karcie, w ktorej siedzi', async () => {
        mockClipboard(jest.fn(async () => {}));
        const handleCardClick = jest.fn();

        render(
            <div onClick={handleCardClick}>
                <CopyEmailButton email={EMAIL} />
            </div>,
        );
        await userEvent.click(screen.getByRole('button', { name: 'copyEmail' }));

        expect(handleCardClick).not.toHaveBeenCalled();
    });

    it('przechodzi asercje jest-axe', async () => {
        mockClipboard(jest.fn(async () => {}));
        const { container } = render(<CopyEmailButton email={EMAIL} />);

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });
});
