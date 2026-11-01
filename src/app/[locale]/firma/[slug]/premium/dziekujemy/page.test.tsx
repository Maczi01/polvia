import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { cloneElement, isValidElement, type ReactNode } from 'react';

import { type CheckoutVerification, verifyPaidCheckoutSession } from '@/lib/premium-checkout';
import { isMaterialsSent } from '@/lib/premium-materials-sent';
import { checkRateLimitWithTimeout, RateLimitCheckTimeoutError } from '@/lib/rate-limit';

import PremiumThanksPage, { generateMetadata } from './page';

expect.extend(toHaveNoViolations);

// Granice zewnetrzne strony: Stripe (`premium-checkout`), Redis (licznik limitu i znacznik
// wysylki), naglowki requestu, mailer i konfiguracja Stripe (env). `premium-rate-limit` (adres i klucz) jest
// prawdziwy. Tlumaczenia zwracaja sam klucz — asercje sprawdzaja wariant.
jest.mock('@/lib/premium-checkout', () => ({ verifyPaidCheckoutSession: jest.fn() }));
jest.mock('@/lib/redis', () => ({ redis: {} }));
jest.mock('@/lib/rate-limit', () => ({
    ...jest.requireActual('@/lib/rate-limit'),
    checkRateLimitWithTimeout: jest.fn(),
}));
jest.mock('@/lib/premium-materials-sent', () => ({ isMaterialsSent: jest.fn() }));
jest.mock('next/headers', () => ({
    headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}));
jest.mock('@/lib/mailer', () => ({ getOperatorInbox: () => 'kontakt@example.com' }));
/** Wariant bez konfiguracji Stripe: `page.disabled.test.tsx`. */
const mockStripe: { config: { portalLoginUrl: string } | null } = { config: null };
jest.mock('@/lib/stripe', () => ({
    get stripeConfig() {
        return mockStripe.config;
    },
}));
jest.mock('../../_actions', () => ({ submitPremiumMaterials: jest.fn() }));
jest.mock('../../_components/premium-materials-form/premium-materials-form', () => ({
    PremiumMaterialsForm: ({ isAlreadySent }: { isAlreadySent: boolean }) => (
        <form aria-label="materials-form" data-already-sent={String(isAlreadySent)} />
    ),
}));
// Klucz z przestrzenia nazw: `title` z dwoch sekcji nie moze dac dwoch identycznych nazw.
jest.mock('next-intl/server', () => ({
    getTranslations: async (namespace: string) =>
        Object.assign((key: string) => `${namespace}.${key}`, {
            rich: (key: string) => `${namespace}.${key}`,
        }),
    setRequestLocale: () => {},
}));
jest.mock('@/i18n/navigation', () => ({
    Link: ({
        href,
        children,
        ...rest
    }: {
        href: { pathname: string; params: { slug: string } };
        children: ReactNode;
    }) => (
        <a href={href.pathname.replace('[slug]', href.params.slug)} {...rest}>
            {children}
        </a>
    ),
}));

const verifyMock = jest.mocked(verifyPaidCheckoutSession);
const rateLimitMock = jest.mocked(checkRateLimitWithTimeout);
const sentMock = jest.mocked(isMaterialsSent);

function thanks(key: string): string {
    return `ServiceProfile.premiumThanks.${key}`;
}

const SESSION_ID = 'cs_test_a1B2c3D4e5F6g7H8';
const SLUG = 'kancelaria-nowak';

/**
 * Rozwija drzewo jak serwer RSC: wywoluje komponenty funkcyjne (takze async) i podstawia
 * ich wynik. Strona i jej warianty to async Server Components, ktorych `render` z RTL
 * nie wykona. Komponenty w tym drzewie nie uzywaja hookow, wiec wywolanie wprost jest bezpieczne.
 */
async function resolveServerTree(node: unknown): Promise<ReactNode> {
    if (Array.isArray(node)) return Promise.all(node.map(resolveServerTree));
    if (!isValidElement<{ children?: unknown }>(node)) {
        return typeof node === 'string' || typeof node === 'number' ? node : null;
    }
    if (typeof node.type === 'function') {
        return resolveServerTree(await Reflect.apply(node.type, undefined, [node.props]));
    }
    if (node.props.children === undefined) return node;
    const children = await resolveServerTree(node.props.children);
    // Statyczne dzieci JSX ida jako osobne argumenty — tablica wymagalaby kluczy.
    return Array.isArray(children)
        ? cloneElement(node, undefined, ...children)
        : cloneElement(node, undefined, children);
}

async function renderPage(sessionId: string = SESSION_ID): Promise<HTMLElement> {
    const page = await PremiumThanksPage({
        params: Promise.resolve({ locale: 'pl', slug: SLUG }),
        searchParams: Promise.resolve({ session_id: sessionId }),
    });
    return render(await resolveServerTree(page)).container;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockStripe.config = { portalLoginUrl: 'https://billing.example.com/login' };
    rateLimitMock.mockResolvedValue({ allowed: true, remaining: 19 });
    sentMock.mockResolvedValue(false);
});

const PAID: CheckoutVerification = {
    status: 'paid',
    target: { serviceId: 'id', slug: SLUG, name: 'Kancelaria Nowak', hasActivePremium: false },
    payer: { name: null, email: null, taxIds: [], address: null },
};

describe('PremiumThanksPage', () => {
    it('awaria Stripe pokazuje "odswiez za chwile" z linkiem do tej samej sesji', async () => {
        verifyMock.mockResolvedValue({ status: 'unavailable' });

        const container = await renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: thanks('unavailableTitle') }),
        ).toBeInTheDocument();
        expect(screen.queryByText(thanks('invalidTitle'))).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: thanks('refresh') })).toHaveAttribute(
            'href',
            `?session_id=${SESSION_ID}`,
        );
        expect(screen.queryByRole('form', { name: 'materials-form' })).not.toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it('po przekroczeniu limitu pokazuje "odswiez" i nie pyta Stripe', async () => {
        rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 600 });

        await renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: thanks('unavailableTitle') }),
        ).toBeInTheDocument();
        expect(verifyMock).not.toHaveBeenCalled();
    });

    it('awaria Redisa nie blokuje platnika: pyta Stripe i pokazuje potwierdzenie', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        rateLimitMock.mockRejectedValue(new Error('Command timed out'));
        verifyMock.mockResolvedValue({
            status: 'paid',
            target: {
                serviceId: 'id',
                slug: SLUG,
                name: 'Kancelaria Nowak',
                hasActivePremium: false,
            },
            payer: { name: null, email: null, taxIds: [], address: null },
        });

        await renderPage();

        expect(verifyMock).toHaveBeenCalledWith(SESSION_ID, SLUG);
        expect(
            screen.getByRole('heading', { level: 1, name: thanks('title') }),
        ).toBeInTheDocument();
        expect(screen.getByRole('form', { name: 'materials-form' })).toBeInTheDocument();
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('failing open'), {
            error: 'Error: Command timed out',
        });
        // Adres klienta nie trafia do logu.
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain('203.0.113.7');
        consoleError.mockRestore();
    });

    it('przekroczony czas limitu przepuszcza do Stripe z logiem', async () => {
        // Sam limit czasu (1500 ms, sprzatanie timera) testuje `rate-limit.test.ts`.
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        rateLimitMock.mockRejectedValue(new RateLimitCheckTimeoutError(1500));
        verifyMock.mockResolvedValue({ status: 'invalid' });

        await renderPage();

        expect(verifyMock).toHaveBeenCalledWith(SESSION_ID, SLUG);
        expect(
            screen.getByRole('heading', { level: 1, name: thanks('invalidTitle') }),
        ).toBeInTheDocument();
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('failing open'), {
            error: 'RateLimitCheckTimeoutError: Rate limit check exceeded 1500 ms',
        });
        consoleError.mockRestore();
    });

    it('limit liczy po adresie klienta pod kluczem strony', async () => {
        verifyMock.mockResolvedValue({ status: 'invalid' });

        await renderPage();

        expect(rateLimitMock).toHaveBeenCalledWith({
            key: 'premium:thanks:203.0.113.7',
            max: 20,
            windowSeconds: 3600,
        });
    });

    it('niepoprawna sesja pokazuje "nie potwierdzono"', async () => {
        verifyMock.mockResolvedValue({ status: 'invalid' });

        await renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: thanks('invalidTitle') }),
        ).toBeInTheDocument();
        expect(screen.queryByText(thanks('unavailableTitle'))).not.toBeInTheDocument();
    });

    it('zly format session_id nie zuzywa limitu ani nie pyta Stripe', async () => {
        await renderPage('not-a-session');

        expect(
            screen.getByRole('heading', { level: 1, name: thanks('invalidTitle') }),
        ).toBeInTheDocument();
        expect(rateLimitMock).not.toHaveBeenCalled();
        expect(verifyMock).not.toHaveBeenCalled();
    });

    it('oplacona sesja pokazuje podziekowanie i formularz materialow', async () => {
        verifyMock.mockResolvedValue({
            status: 'paid',
            target: {
                serviceId: 'id',
                slug: SLUG,
                name: 'Kancelaria Nowak',
                hasActivePremium: false,
            },
            payer: { name: null, email: null, taxIds: [], address: null },
        });

        const container = await renderPage();

        expect(
            screen.getByRole('heading', { level: 1, name: thanks('title') }),
        ).toBeInTheDocument();
        expect(screen.getByRole('form', { name: 'materials-form' })).toBeInTheDocument();
        expect(verifyMock).toHaveBeenCalledWith(SESSION_ID, SLUG);
        expect(await axe(container)).toHaveNoViolations();
    });

    it('materialy tej sesji juz wyslane: formularz dostaje znacznik', async () => {
        verifyMock.mockResolvedValue(PAID);
        sentMock.mockResolvedValue(true);

        await renderPage();

        expect(sentMock).toHaveBeenCalledWith(SESSION_ID);
        expect(screen.getByRole('form', { name: 'materials-form' })).toHaveAttribute(
            'data-already-sent',
            'true',
        );
    });

    it('awaria znacznika wysylki: formularz bez znacznika i log', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        verifyMock.mockResolvedValue(PAID);
        sentMock.mockRejectedValue(new Error('Connection is closed.'));

        await renderPage();

        expect(screen.getByRole('form', { name: 'materials-form' })).toHaveAttribute(
            'data-already-sent',
            'false',
        );
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('materials marker unavailable'),
            { error: 'Error' },
        );
        consoleError.mockRestore();
    });
});

describe('generateMetadata', () => {
    it('strona poza indeksem i bez Referer — session_id nie wychodzi w naglowku', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'xx', slug: SLUG }),
            searchParams: Promise.resolve({ session_id: SESSION_ID }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: false });
        expect(metadata.referrer).toBe('no-referrer');
    });
});
