import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { type AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';

import { LanguageSelect } from './language-select';
import pl from '../../../../../../messages/pl.json';
import uk from '../../../../../../messages/uk.json';
import type { ServiceLanguage } from '@/lib/languages';

expect.extend(toHaveNoViolations);

const COUNTS: Record<ServiceLanguage, number> = { pl: 12, uk: 5, ru: 3, en: 4, be: 0 };

type Props = React.ComponentProps<typeof LanguageSelect>;

function renderSelect(
    overrides: Partial<Props> = {},
    { locale = 'pl', messages = pl }: { locale?: string; messages?: AbstractIntlMessages } = {},
): ReturnType<typeof render> {
    const props: Props = { value: null, onChange: jest.fn(), counts: COUNTS, ...overrides };
    return render(
        <NextIntlClientProvider locale={locale} messages={messages}>
            <LanguageSelect {...props} />
        </NextIntlClientProvider>,
    );
}

async function openSelect(): Promise<void> {
    await userEvent.click(screen.getByRole('combobox', { name: /^Język obsługi: / }));
}

describe('<LanguageSelect />', () => {
    it('bez filtra wyzwalacz pokazuje „Dowolny jezyk" i ma nazwe kontrolki z wartoscia', () => {
        renderSelect();

        const trigger = screen.getByRole('combobox', { name: 'Język obsługi: Dowolny język' });
        expect(trigger).toHaveTextContent('Dowolny język');
    });

    it('wybrany jezyk pokazuje jego endonim w wyzwalaczu i w nazwie dostepnej', () => {
        renderSelect({ value: 'uk' });

        const trigger = screen.getByRole('combobox', { name: 'Język obsługi: Українська' });
        expect(trigger).toHaveTextContent('Українська');
    });

    it('lista ma „Dowolny jezyk" i piec endonimow w stalej kolejnosci, z liczba w nazwie', async () => {
        renderSelect();
        await openSelect();

        const names = screen.getAllByRole('option').map(option => option.textContent);
        expect(names).toEqual([
            'Dowolny język',
            'Polski12 (12)',
            'Українська5 (5)',
            'Русский3 (3)',
            'English4 (4)',
            'Беларуская0 (0)',
        ]);
        expect(screen.getByRole('option', { name: 'Русский (3)' })).toBeInTheDocument();
    });

    it('wybor „Русский" oddaje kod ru', async () => {
        const onChange = jest.fn();
        renderSelect({ onChange });
        await openSelect();

        await userEvent.click(screen.getByRole('option', { name: 'Русский (3)' }));

        expect(onChange).toHaveBeenCalledWith('ru');
    });

    it('wybor „Dowolny jezyk" oddaje null', async () => {
        const onChange = jest.fn();
        renderSelect({ value: 'ru', onChange });
        await openSelect();

        await userEvent.click(screen.getByRole('option', { name: 'Dowolny język' }));

        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('jezyk z licznikiem 0 zostaje klikalny (R5)', async () => {
        const onChange = jest.fn();
        renderSelect({ onChange });
        await openSelect();

        const belarusian = screen.getByRole('option', { name: 'Беларуская (0)' });
        expect(belarusian).not.toHaveAttribute('aria-disabled', 'true');
        await userEvent.click(belarusian);

        expect(onChange).toHaveBeenCalledWith('be');
    });

    it('bez licznikow opcje maja sam endonim', async () => {
        renderSelect({ counts: undefined });
        await openSelect();

        expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    });

    it('na locale uk tlumaczy etykiety, a endonimy zostaja te same (R4)', () => {
        renderSelect({}, { locale: 'uk', messages: uk });

        const trigger = screen.getByRole('combobox', {
            name: `${uk.MapPage.languageFilter}: ${uk.MapPage.anyLanguage}`,
        });
        expect(trigger).toHaveTextContent(uk.MapPage.anyLanguage);
    });

    it('nie ma naruszen dostepnosci — zamkniety i otwarty', async () => {
        const { container } = renderSelect({ value: 'pl' });
        expect(await axe(container)).toHaveNoViolations();

        await openSelect();
        // Lista otwiera sie w portalu poza `container` — audyt idzie na sam listbox.
        expect(await axe(screen.getByRole('listbox'))).toHaveNoViolations();
    });

    it('contentClassName trafia na liste opcji i wygrywa z domyslnym z-index', async () => {
        renderSelect({ contentClassName: 'z-[1000]' });
        await openSelect();

        expect(screen.getByRole('listbox')).toHaveClass('z-[1000]');
        expect(screen.getByRole('listbox')).not.toHaveClass('z-[105]');
    });

    describe('wariant kompaktowy (pasek desktop)', () => {
        it('wybrany jezyk: flaga i kod wielkimi literami zamiast endonimu', () => {
            const { container } = renderSelect({ value: 'ru', variant: 'compact' });

            const trigger = screen.getByRole('combobox', { name: 'Język obsługi: Русский' });
            expect(trigger).toHaveTextContent('RU');
            expect(trigger).not.toHaveTextContent('Русский');
            expect(container.querySelector('img[src*="ru"]')).not.toBeNull();
        });

        it('„Dowolny jezyk": ikona globu, nazwa dostepna z etykieta i wartoscia', () => {
            renderSelect({ value: null, variant: 'compact' });

            const trigger = screen.getByRole('combobox', { name: 'Język obsługi: Dowolny język' });
            expect(trigger.querySelector('svg.lucide-globe')).not.toBeNull();
            expect(trigger).not.toHaveTextContent('Dowolny język');
        });

        it('lista po otwarciu nadal ma endonimy i liczniki', async () => {
            renderSelect({ value: 'ru', variant: 'compact' });
            await openSelect();

            expect(screen.getByRole('option', { name: 'Русский (3)' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'Українська (5)' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'Dowolny język' })).toBeInTheDocument();
        });

        it('nie ma naruszen dostepnosci — zamkniety i otwarty', async () => {
            const { container } = renderSelect({ value: 'uk', variant: 'compact' });
            expect(await axe(container)).toHaveNoViolations();

            await openSelect();
            expect(await axe(screen.getByRole('listbox'))).toHaveNoViolations();
        });
    });
});
