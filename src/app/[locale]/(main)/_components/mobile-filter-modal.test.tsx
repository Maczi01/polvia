import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { MobileFilterModal } from './mobile-filter-modal';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna — mock zwraca sam klucz, wiec asercje
// sprawdzaja zachowanie, nie tresc tlumaczen.
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

type ModalProps = React.ComponentProps<typeof MobileFilterModal>;

function renderModal(overrides: Partial<ModalProps> = {}): ReturnType<typeof render> {
    const props: ModalProps = {
        isOpen: false,
        onClose: jest.fn(),
        selectedCategory: 'legal',
        onCategoryChange: jest.fn(),
        searchQuery: '',
        onSearchChange: jest.fn(),
        selectedCounty: '',
        onCountyChange: jest.fn(),
        onlineOnly: false,
        onOnlineToggle: jest.fn(),
        resetAllFilters: jest.fn(),
        clearCategories: jest.fn(),
        ...overrides,
    };
    return render(<MobileFilterModal {...props} />);
}

describe('<MobileFilterModal />', () => {
    beforeAll(() => {
        // lockScroll/unlockScroll wolaja window.scrollTo, ktorego jsdom nie implementuje.
        // Bez restore: unlockScroll odpala sie jeszcze w cleanupie RTL po ostatnim tescie.
        jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    it('zamkniety: zadna kontrolka modala nie jest osiagalna klawiatura ani dla czytnika', async () => {
        const { container } = renderModal({ isOpen: false });

        // jsdom nie wylicza inert w kolejnosci Tab, wiec asercja idzie na atrybut przodka
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThan(0);
        buttons.forEach(button => {
            expect(button.closest('[inert]')).not.toBeNull();
        });
        expect(await axe(container)).toHaveNoViolations();
    });

    it('otwarty: kontrolki sa osiagalne, dialog ma nazwe z naglowka i przejmuje fokus', async () => {
        const { container } = renderModal({ isOpen: true });

        container.querySelectorAll('button').forEach(button => {
            expect(button.closest('[inert]')).toBeNull();
        });
        const dialog = screen.getByRole('dialog', { name: 'Filters' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(screen.getByRole('button', { name: 'Go Back' })).toHaveFocus();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('Escape zamyka otwarty modal', async () => {
        const onClose = jest.fn();
        renderModal({ isOpen: true, onClose });

        await userEvent.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Tab na ostatniej kontrolce wraca na pierwsza, Shift+Tab na pierwszej idzie na ostatnia', async () => {
        renderModal({ isOpen: true });
        const buttons = screen.getAllByRole('button');
        const first = buttons.at(0);
        const last = buttons.at(-1);
        expect(buttons.length).toBeGreaterThan(1);

        last?.focus();
        await userEvent.tab();
        expect(first).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(last).toHaveFocus();
    });
});
