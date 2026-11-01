import { fireEvent, render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../../../../messages/en.json';
import pl from '../../../../../../../messages/pl.json';
import ru from '../../../../../../../messages/ru.json';
import uk from '../../../../../../../messages/uk.json';
import { ESSENTIALS_FEATURE_KEYS, PricingPlans } from './pricing-plans';

expect.extend(toHaveNoViolations);

/**
 * Bez mocka `@/i18n/navigation`: linki ida przez prawdziwy routing next-intl
 * (`localePrefix: 'as-needed'` + `pathnames`), wiec test widzi sciezke uzytkownika.
 * Zastepujemy tylko hooki App Routera.
 */
jest.mock('next/navigation', () => ({
    usePathname: () => '/',
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    useParams: () => ({}),
    redirect: jest.fn(),
    permanentRedirect: jest.fn(),
}));

const MESSAGES = { pl, en, ru, uk };
type Locale = keyof typeof MESSAGES;

const PORTAL_URL = 'https://billing.stripe.com/p/login/test_123';

/** Obietnice z R19, ktorych premium nie dostarcza albo ktore ma kazdy darmowy profil. */
const REMOVED_PROMISES_PL = [
    'Obecność na wyszukiwarce semantycznej',
    'Powitanie w mediach społecznościowych',
    'Możliwość dodania promocji',
    'Link do strony internetowej',
    'Profile w mediach społecznościowych',
];

function renderPlans(locale: Locale = 'pl'): ReturnType<typeof render> {
    return render(
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Warsaw">
            <PricingPlans heading={<h1>{MESSAGES[locale].Pricing.choosePlan}</h1>} portalUrl={PORTAL_URL} />
        </NextIntlClientProvider>,
    );
}

function essentialsCard(locale: Locale = 'pl'): HTMLElement {
    return screen.getByRole('article', { name: MESSAGES[locale].Pricing.plans.essentials.title });
}

describe('PricingPlans', () => {
    it('plan Profesjonalny wymienia tylko cechy premium, bez usunietych obietnic', () => {
        renderPlans();

        const items = within(essentialsCard())
            .getAllByRole('listitem')
            .map(item => item.textContent);

        expect(items).toEqual(
            ESSENTIALS_FEATURE_KEYS.map(key => pl.Pricing.plans.essentials.features[key]),
        );
        for (const promise of REMOVED_PROMISES_PL) {
            expect(screen.queryByText(promise)).not.toBeInTheDocument();
        }
    });

    it('zadne locale nie ma kluczy usunietych obietnic w planie Profesjonalny', () => {
        for (const messages of Object.values(MESSAGES)) {
            expect(Object.keys(messages.Pricing.plans.essentials.features)).toEqual([
                ...ESSENTIALS_FEATURE_KEYS,
            ]);
        }
    });

    it.each([
        ['pl', '/dodaj-firme', '/mapa', '/kontakt'],
        ['en', '/en/add-business', '/en/map', '/en/contact'],
        ['ru', '/ru/add-business', '/ru/map', '/ru/contact'],
    ] as const)('CTA planow w %s prowadza do istniejacych tras', (locale, free, map, contact) => {
        renderPlans(locale);
        const plans = MESSAGES[locale].Pricing.plans;

        expect(screen.getByRole('link', { name: plans.free.cta })).toHaveAttribute('href', free);
        expect(screen.getByRole('link', { name: plans.essentials.cta })).toHaveAttribute(
            'href',
            map,
        );
        expect(screen.getByRole('link', { name: plans.team.cta })).toHaveAttribute(
            'href',
            contact,
        );
    });

    it('CTA Profesjonalnego opisuje instrukcja „znajdz firme i kliknij Ulepsz”', () => {
        renderPlans();

        expect(screen.getByRole('link', { name: pl.Pricing.plans.essentials.cta })).toHaveAccessibleDescription(
            pl.Pricing.plans.essentials.instruction,
        );
    });

    it('link do portalu Stripe otwiera adres z propsa w nowej karcie', () => {
        renderPlans();

        const link = screen.getByRole('link', { name: /Zarządzaj subskrypcją/ });
        expect(link).toHaveAttribute('href', PORTAL_URL);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('przelacznik okresu zmienia cene planu Profesjonalny miedzy 49 a 9 zl', () => {
        renderPlans();
        const card = essentialsCard();
        const monthly = screen.getByRole('button', { name: pl.Pricing.monthly });
        const annual = screen.getByRole('button', { name: pl.Pricing.annual });

        expect(within(card).getByText('49 zł')).toBeInTheDocument();
        expect(annual).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(monthly);

        expect(within(card).getByText('9 zł')).toBeInTheDocument();
        expect(within(card).queryByText('49 zł')).not.toBeInTheDocument();
        expect(monthly).toHaveAttribute('aria-pressed', 'true');
        expect(annual).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(annual);

        expect(within(card).getByText('49 zł')).toBeInTheDocument();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderPlans();

        expect(await axe(container)).toHaveNoViolations();
    });
});
