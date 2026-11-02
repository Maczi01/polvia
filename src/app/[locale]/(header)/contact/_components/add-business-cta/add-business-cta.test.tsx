import { render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

import messages from '../../../../../../../messages/pl.json';
import { AddBusinessCta } from './add-business-cta';

expect.extend(toHaveNoViolations);

// Routing next-intl ciagnie App Router: mock renderuje wewnetrzna sciezke, lokalizacja to zadanie next-intl.
jest.mock('@/i18n/navigation', () => ({
    Link: ({
        href,
        children,
        ...rest
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

function renderCta(): ReturnType<typeof render> {
    return render(
        <NextIntlClientProvider locale="pl" messages={messages} timeZone="Europe/Warsaw">
            <AddBusinessCta />
        </NextIntlClientProvider>,
    );
}

describe('AddBusinessCta', () => {
    it('renderuje link "Dodaj firmę z AI" do sciezki /add-business', () => {
        renderCta();

        const link = screen.getByRole('link', { name: 'Dodaj firmę z AI' });
        expect(link).toHaveAttribute('href', '/add-business');
    });

    it('opisuje sekcje naglowkiem i zdaniem o wklejeniu linku', () => {
        renderCta();

        expect(
            screen.getByRole('region', { name: messages.addBusiness.cta.heading }),
        ).toBeInTheDocument();
        expect(screen.getByText(messages.addBusiness.cta.description)).toBeInTheDocument();
    });

    it('pokazuje wpis bezplatny z cena 0 zl obok strony Premium', () => {
        renderCta();

        const free = screen.getByRole('article', { name: messages.addBusiness.cta.freeTitle });
        expect(within(free).getByText('0 zł')).toBeInTheDocument();
        expect(
            within(free).getByText(messages.Pricing.plans.free.features['1']),
        ).toBeInTheDocument();
    });

    it('strona Premium wymienia korzysci z cennika i prowadzi do /pricing', () => {
        renderCta();

        const premium = screen.getByRole('article', {
            name: messages.addBusiness.cta.premiumTitle,
        });
        expect(within(premium).getByText('9 zł/miesiąc')).toBeInTheDocument();
        expect(
            within(premium).getByText(messages.Pricing.plans.essentials.features.shortUrl),
        ).toBeInTheDocument();
        expect(
            within(premium).getByRole('link', { name: messages.addBusiness.cta.premiumButton }),
        ).toHaveAttribute('href', '/pricing');
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderCta();

        expect(await axe(container)).toHaveNoViolations();
    });
});
