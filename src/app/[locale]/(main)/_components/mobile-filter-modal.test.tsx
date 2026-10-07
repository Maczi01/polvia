import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import { MobileFilterModal } from './mobile-filter-modal';

expect.extend(toHaveNoViolations);

// next-intl to biblioteka zewnetrzna — mock zwraca sam klucz, wiec asercje
// sprawdzaja zachowanie, nie tresc tlumaczen.
jest.mock('next-intl', () => ({
    // Wartosci ICU doklejamy do klucza, zeby dalo sie sprawdzic, ze liczba w ogole
    // dociera do etykiety. Tresc tlumaczen nie jest tu przedmiotem testu.
    useTranslations:
        () =>
        (key: string, values?: Record<string, unknown>): string =>
            values ? `${key}:${Object.values(values).join(',')}` : key,
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
        clearCategories: jest.fn(),
        totalCount: 0,
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
        expect(screen.getByRole('button', { name: 'closeFilters' })).toHaveFocus();
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

    // Regresja: arkusz dostawal `onSearchChange` i `onCountyChange`, ale nie
    // renderowal zadnej kontrolki, ktora by je wolala — w kodzie stal komentarz
    // "(Optional) insert search and county selects here". Na mobile nie bylo
    // wiec zadnego sposobu, zeby szukac tekstem albo wybrac wojewodztwo.
    it('arkusz ma wyszukiwarke i wybor lokalizacji, nie same kategorie', () => {
        renderModal({ isOpen: true });

        expect(screen.getByRole('textbox', { name: 'search' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'selectCounty' })).toBeInTheDocument();
    });

    it('wpisanie tekstu w wyszukiwarke oddaje go rodzicowi', async () => {
        const onSearchChange = jest.fn();
        renderModal({ isOpen: true, onSearchChange });

        await userEvent.type(screen.getByRole('textbox', { name: 'search' }), 'ab');

        expect(onSearchChange).toHaveBeenCalledTimes(2);
        expect(onSearchChange).toHaveBeenLastCalledWith('b');
    });

    it('wybor kategorii NIE zamyka arkusza — zostaje miejsce na reszte filtrow', async () => {
        const onClose = jest.fn();
        const onCategoryChange = jest.fn();
        renderModal({ isOpen: true, onClose, onCategoryChange, selectedCategory: '' });

        await userEvent.click(screen.getByRole('button', { name: 'Categories.Grocery' }));

        expect(onCategoryChange).toHaveBeenCalledWith('grocery');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('stopka podaje liczbe wynikow i zamyka arkusz', async () => {
        const onClose = jest.fn();
        renderModal({ isOpen: true, onClose, totalCount: 27 });

        const cta = screen.getByRole('button', { name: 'showResults:27' });
        await userEvent.click(cta);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('zero wynikow tez zamyka, a nazwa stopki nie dubluje strzalki z naglowka', async () => {
        const onClose = jest.fn();
        renderModal({ isOpen: true, onClose, totalCount: 0 });

        // Jedno `closeFilters` w calym arkuszu: strzalka w naglowku. Stopka ma
        // wlasna nazwe, bo dwa przyciski „Zamknij filtry" sa nie do rozroznienia
        // dla czytnika ekranu.
        expect(screen.getAllByRole('button', { name: 'closeFilters' })).toHaveLength(1);

        await userEvent.click(screen.getByRole('button', { name: 'showResults:0' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // Regresja: przycisk czysci wylacznie kategorie, ale zapalal sie takze dla
    // tekstu, zasiegu i wojewodztwa — dalo sie go kliknac i nie zobaczyc zmiany.
    describe('przycisk czyszczenia kategorii', () => {
        const nazwa = 'Categories.RemoveFilterMobile';

        it('jest nieaktywny, gdy zadna kategoria nie jest wybrana', () => {
            renderModal({
                isOpen: true,
                selectedCategory: '',
                searchQuery: 'fryzjer',
                onlineOnly: true,
                selectedCounty: 'pomorskie',
            });

            expect(screen.getByRole('button', { name: nazwa })).toBeDisabled();
        });

        it('jest aktywny, gdy kategoria jest wybrana', () => {
            renderModal({ isOpen: true, selectedCategory: 'law' });

            expect(screen.getByRole('button', { name: nazwa })).toBeEnabled();
        });

        it('czysci kategorie, nie reszte filtrow', async () => {
            const clearCategories = jest.fn();
            renderModal({ isOpen: true, selectedCategory: 'law', clearCategories });

            await userEvent.click(screen.getByRole('button', { name: nazwa }));

            expect(clearCategories).toHaveBeenCalledTimes(1);
        });
    });
});
