import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { AnchorHTMLAttributes, ReactElement, ReactNode } from 'react';

import type { PremiumPurchase } from '@/lib/premium-checkout-fields';

import { renderWithIntl } from '../profile-test-utils';
import { ProfileUpgradeCta } from './profile-upgrade-cta';

expect.extend(toHaveNoViolations);

type MockHref = { pathname: string; query?: Record<string, string> };

/** Routing next-intl ciagnie App Router — link renderuje sciezke wewnetrzna z query. */
jest.mock('@/i18n/navigation', () => ({
    Link: ({
        href,
        children,
        ...rest
    }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
        href: MockHref | string;
        children: ReactNode;
    }): ReactElement => (
        <a
            href={
                typeof href === 'string'
                    ? href
                    : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
            }
            {...rest}
        >
            {children}
        </a>
    ),
}));

const SERVICE_ID = '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01';
const SLUG = 'mistrz-remontu';
const checkoutAction = jest.fn(async () => null);
const CHECKOUT: PremiumPurchase = { kind: 'checkout', action: checkoutAction };
const CONTACT: PremiumPurchase = { kind: 'contact' };

describe('ProfileUpgradeCta', () => {
    it('ma przycisk "To moja firma — ulepsz stronę" w formularzu checkoutu wpisu', async () => {
        const { container } = renderWithIntl(
            <ProfileUpgradeCta serviceId={SERVICE_ID} slug={SLUG} purchase={CHECKOUT} />,
        );

        const cta = screen.getByRole('button', { name: 'To moja firma — ulepsz stronę' });
        expect(cta.closest('form')).toHaveFormValues({ serviceId: SERVICE_ID });
        expect(await axe(container)).toHaveNoViolations();
    });

    it('wymienia korzysci premium z limitem galerii', () => {
        renderWithIntl(
            <ProfileUpgradeCta serviceId={SERVICE_ID} slug={SLUG} purchase={CHECKOUT} />,
        );

        const section = screen.getByRole('region', { name: 'To Twoja firma?' });
        expect(
            within(section)
                .getAllByRole('listitem')
                .map(item => item.textContent),
        ).toEqual([
            'Wyższa pozycja na liście wyników i na mapie',
            'Zdjęcie w nagłówku i galeria do 15 zdjęć',
            'Wybór jednego z 3 szablonów strony',
            'Cennik usług i odpowiedzi na częste pytania',
            'Oceny z Google Maps i Booksy na Twojej stronie',
            'Bez sekcji „Podobne firmy” — nie polecamy konkurencji',
        ]);
    });

    it.each([
        ['ze Stripe', CHECKOUT],
        ['bez Stripe', CONTACT],
    ])('%s: link do przykladowej strony premium; przechodzi jest-axe', async (_, purchase) => {
        const { container } = renderWithIntl(
            <ProfileUpgradeCta serviceId={SERVICE_ID} slug={SLUG} purchase={purchase} />,
        );

        const section = screen.getByRole('region', { name: 'To Twoja firma?' });
        expect(
            within(section).getByRole('link', { name: 'Zobacz przykładową stronę' }),
        ).toHaveAttribute('href', '/pricing/example');
        expect(await axe(container)).toHaveNoViolations();
    });

    it('bez Stripe: link do kontaktu z tematem premium i slugiem firmy, bez formularza platnosci', async () => {
        const { container } = renderWithIntl(
            <ProfileUpgradeCta serviceId={SERVICE_ID} slug={SLUG} purchase={CONTACT} />,
        );

        const link = screen.getByRole('link', { name: 'To moja firma — ulepsz stronę' });
        expect(link).toHaveAttribute('href', `/contact?topic=premium&firma=${SLUG}`);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument();
        expect(screen.getByText(/1 dzień roboczy/)).toBeInTheDocument();
        expect(checkoutAction).not.toHaveBeenCalled();
        expect(await axe(container)).toHaveNoViolations();
    });
});
