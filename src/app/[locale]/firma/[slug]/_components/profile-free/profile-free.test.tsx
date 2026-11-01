import { screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import type { PremiumPurchase } from '@/lib/premium-checkout-fields';

import {
    localServiceFixture,
    noLogoServiceFixture,
    onlineServiceFixture,
} from '../profile-fixtures';
import { renderWithIntl } from '../profile-test-utils';
import { ProfileFree } from './profile-free';

expect.extend(toHaveNoViolations);

/** Akcja checkoutu nie jest wolana w tych testach — profil tylko renderuje CTA. */
const checkoutAction = jest.fn(async () => null);
const purchase: PremiumPurchase = { kind: 'checkout', action: checkoutAction };

jest.mock('@/i18n/navigation', () => ({
    Link: jest.requireActual('../profile-test-utils').MockLink,
}));

describe('ProfileFree', () => {
    it('renderuje nazwe jako h1 i przechodzi jest-axe', async () => {
        const { container } = renderWithIntl(
            <ProfileFree profile={localServiceFixture} purchase={purchase} />,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Mistrz Remontu' }),
        ).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('pokazuje dane wpisu jak karta: kontakt, godziny, adresy, jezyki i tagi', () => {
        renderWithIntl(
            <ProfileFree profile={localServiceFixture} purchase={purchase} />,
        );

        expect(screen.getByRole('region', { name: 'Kontakt' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Telegram' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Godziny otwarcia' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Lokalizacje' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Pokaż na mapie' })).toBeInTheDocument();
        const about = screen.getByRole('region', { name: 'O firmie' });
        expect(within(about).getByText('ukraiński')).toBeInTheDocument();
        expect(within(about).getByText('Łazienki')).toBeInTheDocument();
    });

    it('renderuje "Podobne firmy" i CTA ulepszenia jako checkout tego wpisu', () => {
        renderWithIntl(
            <ProfileFree profile={localServiceFixture} purchase={purchase} />,
        );

        const similar = screen.getByRole('region', { name: 'Podobne firmy' });
        expect(within(similar).getAllByRole('link')).toHaveLength(4);
        const cta = screen.getByRole('button', { name: 'To moja firma — ulepsz stronę' });
        expect(cta.closest('form')).toHaveFormValues({
            serviceId: localServiceFixture.serviceId,
            interval: 'monthly',
        });
        expect(checkoutAction).not.toHaveBeenCalled();
    });

    it('wpis online-only: badge "Online", bez adresu i mapy', async () => {
        const { container } = renderWithIntl(
            <ProfileFree profile={onlineServiceFixture} purchase={purchase} />,
        );

        expect(screen.getByText('Online')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: /Adres|Lokalizacje/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Pokaż na mapie' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Nawiguj' })).not.toBeInTheDocument();
        expect(container.querySelector('address')).toBeNull();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('wpis bez logo, opisu i podobnych firm: zastepcze logo, bez pustych sekcji', async () => {
        const { container } = renderWithIntl(
            <ProfileFree profile={noLogoServiceFixture} purchase={purchase} />,
        );

        const logo = screen.getByRole('img', { name: `Logo firmy ${noLogoServiceFixture.name}` });
        expect(logo.getAttribute('src')).toContain(encodeURIComponent('/default.png'));
        expect(screen.queryByRole('region', { name: 'Podobne firmy' })).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'To moja firma — ulepsz stronę' }),
        ).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });
});
