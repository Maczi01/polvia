import { fireEvent, render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../../../../../messages/en.json';
import pl from '../../../../../../../messages/pl.json';
import ru from '../../../../../../../messages/ru.json';
import uk from '../../../../../../../messages/uk.json';
import { ESSENTIALS_FEATURE_KEYS, PricingPlans, type PricingPurchase } from './pricing-plans';

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
const CHECKOUT: PricingPurchase = { kind: 'checkout', portalUrl: PORTAL_URL };

/** Obietnice z R19, ktorych premium nie dostarcza albo ktore ma kazdy darmowy profil. */
const REMOVED_PROMISES_PL = [
    'Obecność na wyszukiwarce semantycznej',
    'Powitanie w mediach społecznościowych',
    'Możliwość dodania promocji',
    'Link do strony internetowej',
    'Profile w mediach społecznościowych',
];

function renderPlans(
    locale: Locale = 'pl',
    purchase: PricingPurchase = CHECKOUT,
): ReturnType<typeof render> {
    return render(
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Warsaw">
            <PricingPlans heading={<h1>{MESSAGES[locale].Pricing.choosePlan}</h1>} purchase={purchase} />
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
        ['pl', '/dodaj-firme', '/mapa'],
        ['en', '/en/add-business', '/en/map'],
        ['ru', '/ru/add-business', '/ru/map'],
        ['uk', '/uk/add-business', '/uk/map'],
    ] as const)('CTA planow w %s prowadza do istniejacych tras', (locale, free, map) => {
        renderPlans(locale);
        const plans = MESSAGES[locale].Pricing.plans;

        expect(screen.getByRole('link', { name: plans.free.cta })).toHaveAttribute('href', free);
        expect(screen.getByRole('link', { name: plans.essentials.cta })).toHaveAttribute(
            'href',
            map,
        );
    });

    it('sa tylko dwa plany: darmowy i Profesjonalny, bez wyceny indywidualnej', () => {
        renderPlans();

        expect(screen.getAllByRole('article')).toHaveLength(2);
        expect(screen.getByRole('article', { name: pl.Pricing.plans.free.title })).toBeInTheDocument();
        expect(essentialsCard()).toBeInTheDocument();
        expect(screen.queryByText('Wycena indywidualna')).not.toBeInTheDocument();
        for (const messages of Object.values(MESSAGES)) {
            expect(Object.keys(messages.Pricing.plans)).toEqual(['free', 'essentials']);
        }
    });

    it('darmowy plan obiecuje podstawowa strone firmy, Profesjonalny rozbudowana wg szablonu', () => {
        renderPlans();
        const free = screen.getByRole('article', { name: pl.Pricing.plans.free.title });

        expect(within(free).getByText(pl.Pricing.plans.free.features['7'])).toHaveTextContent(
            /Podstawowa strona firmy/,
        );
        expect(
            within(essentialsCard()).getByText(pl.Pricing.plans.essentials.features.templates),
        ).toHaveTextContent(/według wybranego wzoru/);
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

    it('domyslnie miesieczny jak na profilu; przelacznik zmienia cene miedzy 9 a 49 zl', () => {
        renderPlans();
        const card = essentialsCard();
        const monthly = screen.getByRole('button', { name: pl.Pricing.monthly });
        const yearly = screen.getByRole('button', { name: pl.Pricing.yearly });

        expect(within(card).getByText('19 zł')).toBeInTheDocument();
        expect(within(card).getByText('/miesiąc')).toBeInTheDocument();
        expect(monthly).toHaveAttribute('aria-pressed', 'true');
        expect(yearly).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(yearly);

        expect(within(card).getByText('99 zł')).toBeInTheDocument();
        expect(within(card).getByText('/rok')).toBeInTheDocument();
        expect(within(card).queryByText('19 zł')).not.toBeInTheDocument();
        expect(yearly).toHaveAttribute('aria-pressed', 'true');
        expect(monthly).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(monthly);

        expect(within(card).getByText('19 zł')).toBeInTheDocument();
    });

    it.each([
        ['pl', '/kontakt?topic=premium'],
        ['en', '/en/contact?topic=premium'],
        ['ru', '/ru/contact?topic=premium'],
        ['uk', '/uk/contact?topic=premium'],
    ] as const)(
        'bez Stripe w %s plan Profesjonalny prowadzi do kontaktu z tematem premium',
        (locale, contact) => {
            renderPlans(locale, { kind: 'contact' });
            const essentials = MESSAGES[locale].Pricing.plans.essentials;

            const link = screen.getByRole('link', { name: essentials.contactCta });
            expect(link).toHaveAttribute('href', contact);
            expect(link).toHaveAccessibleDescription(essentials.contactInstruction);
            expect(screen.queryByRole('link', { name: essentials.cta })).not.toBeInTheDocument();
        },
    );

    it('bez Stripe nie ma linku do portalu subskrypcji ani obietnicy platnosci od reki', async () => {
        const { container } = renderPlans('pl', { kind: 'contact' });

        expect(screen.queryByRole('link', { name: /Zarządzaj subskrypcją/ })).not.toBeInTheDocument();
        expect(within(essentialsCard()).getByText(/1 dzień roboczy/)).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('nie ma naruszen dostepnosci', async () => {
        const { container } = renderPlans();

        expect(await axe(container)).toHaveNoViolations();
    });
});
