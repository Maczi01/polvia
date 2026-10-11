import { act, render, type RenderResult, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../../../../messages/en.json';
import pl from '../../../../../../../messages/pl.json';
import ru from '../../../../../../../messages/ru.json';
import uk from '../../../../../../../messages/uk.json';
import { DuplicateNotice } from './flow-notices';

expect.extend(toHaveNoViolations);

/**
 * W odroznieniu od `flow-notices.test.tsx` NIE mockujemy `@/i18n/navigation`: link idzie
 * przez prawdziwy routing next-intl (`pathnames`, `localePrefix: 'as-needed'`), wiec test
 * widzi sciezke, ktora dostanie uzytkownik. Zastepujemy tylko hooki App Routera.
 */
jest.mock('next/navigation', () => ({
    usePathname: () => '/',
    useRouter: () => ({}),
    useParams: () => ({}),
    redirect: jest.fn(),
    permanentRedirect: jest.fn(),
}));

const MESSAGES = { pl, en, ru, uk };
type Locale = keyof typeof MESSAGES;

function renderDuplicate(locale: Locale): RenderResult {
    return render(
        <NextIntlClientProvider
            locale={locale}
            messages={MESSAGES[locale]}
            timeZone="Europe/Warsaw"
        >
            <DuplicateNotice name="Kawiarnia Lwów" slug="kawiarnia-lwow" onStartOver={jest.fn()} />
        </NextIntlClientProvider>,
    );
}

function entryHref(): string | null {
    // Pierwszy link panelu to wpis firmy; drugi — formularz kontaktowy.
    return screen.getAllByRole('link')[0].getAttribute('href');
}

describe('<DuplicateNotice /> — lokalizowany link do wpisu', () => {
    it('pl: polska sciezka mapy bez prefiksu locale', () => {
        renderDuplicate('pl');

        expect(entryHref()).toBe('/mapa?place=kawiarnia-lwow');
    });

    it.each(['ru', 'uk'] as const)('%s: wlasny prefiks, nigdy /en', locale => {
        renderDuplicate(locale);
        const href = entryHref();

        expect(href).not.toMatch(/^\/en(\/|\?|$)/);
        expect(href).toBe(`/${locale}/map?place=kawiarnia-lwow`);
    });

    it('en: prefiks /en', () => {
        renderDuplicate('en');

        expect(entryHref()).toBe('/en/map?place=kawiarnia-lwow');
    });

    it('nie ma naruszen dostepnosci (uk)', async () => {
        const { container } = renderDuplicate('uk');
        // axe pracuje asynchronicznie, a `next/link` w tym czasie aktualizuje swoj stan.
        expect(await act(() => axe(container))).toHaveNoViolations();
    });
});
