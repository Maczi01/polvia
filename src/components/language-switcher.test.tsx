import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import pl from '../../messages/pl.json';
import { LanguageSwitcher } from './language-switcher';

expect.extend(toHaveNoViolations);

const replace = jest.fn();
let mockPathname = '/firma/[slug]';
let mockParams: Record<string, string> = { locale: 'pl', slug: 'x' };

// Granica testu to wywolanie routera next-intl: sprawdzamy, co przelacznik mu przekazuje.
jest.mock('@/i18n/navigation', () => ({
    useRouter: () => ({ replace }),
    usePathname: () => mockPathname,
}));

jest.mock('next/navigation', () => ({
    useParams: () => mockParams,
    useSearchParams: () => new URLSearchParams(),
}));

function renderSwitcher() {
    return render(
        <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw">
            <LanguageSwitcher locale="pl" />
        </NextIntlClientProvider>,
    );
}

async function chooseLanguage(name: string): Promise<void> {
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name }));
}

beforeEach(() => {
    replace.mockClear();
    localStorage.clear();
    mockPathname = '/firma/[slug]';
    mockParams = { locale: 'pl', slug: 'x' };
});

describe('<LanguageSwitcher /> — trasa z parametrem', () => {
    it('zmiana jezyka na profilu przekazuje params ze slugiem (bez locale)', async () => {
        renderSwitcher();

        await chooseLanguage('English flag English');

        expect(replace).toHaveBeenCalledWith(
            { pathname: '/firma/[slug]', params: { slug: 'x' }, query: {} },
            { locale: 'en' },
        );
    });

    it('zapisany preferowany jezyk przy montowaniu tez przekazuje params', async () => {
        localStorage.setItem('preferred-locale', 'uk');

        renderSwitcher();

        await waitFor(() =>
            expect(replace).toHaveBeenCalledWith(
                { pathname: '/firma/[slug]', params: { slug: 'x' }, query: {} },
                { locale: 'uk' },
            ),
        );
    });
});

describe('<LanguageSwitcher /> — mapa', () => {
    it('sciezka mapy dalej tlumaczy slug kategorii, bez params', async () => {
        mockPathname = '/mapa/remonty';
        mockParams = { locale: 'pl', slug: 'remonty' };
        renderSwitcher();

        await chooseLanguage('English flag English');

        expect(replace).toHaveBeenCalledWith(
            { pathname: '/map/renovation', query: {} },
            { locale: 'en' },
        );
    });

    it('przechodzi asercje jest-axe', async () => {
        const { container } = renderSwitcher();

        expect(await axe(container)).toHaveNoViolations();
    });
});
