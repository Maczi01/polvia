import { fireEvent, render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';

import type { PartialService } from '@/types';

import en from '../../../../../../messages/en.json';
import pl from '../../../../../../messages/pl.json';
import ru from '../../../../../../messages/ru.json';
import uk from '../../../../../../messages/uk.json';
import { ServiceCard } from './service-card';

expect.extend(toHaveNoViolations);

/**
 * W odroznieniu od `service-card.test.tsx` NIE mockujemy next-intl ani `@/i18n/navigation`:
 * link do profilu idzie przez prawdziwy routing (`localePrefix: 'as-needed'`), wiec test
 * widzi sciezke, ktora dostanie uzytkownik. Zastepujemy tylko hooki App Routera.
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

const SERVICE: PartialService = {
    id: 'loc-1',
    serviceId: 'service-1',
    slug: 'mistrz-remontu-warszawa',
    serviceSlug: 'x',
    name: 'Mistrz Remontu',
    description: null,
    category: 'renovation',
    coverage: 'local',
    tags: null,
    city: 'Warszawa',
    street: 'ul. Testowa 1',
    voivodeship: 'mazowieckie',
    postcode: null,
    latitude: 52.2297,
    longitude: 21.0122,
    openingHours: {},
    phoneNumber: null,
    email: null,
    webpage: null,
    image: null,
    languages: ['pl'],
    socials: null,
    whatsappNumber: null,
    verified: false,
};

// Karta zglasza klik do /api/increase-popularity-counter, a jsdom nie ma fetch.
beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never;
});

function renderExpandedCard(locale: Locale, setCardToExpand = jest.fn()) {
    const result = render(
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Warsaw">
            <ServiceCard
                {...SERVICE}
                index={0}
                handleFlyTo={jest.fn()}
                resetMap={jest.fn()}
                setCardToExpand={setCardToExpand}
                cardToExpand={SERVICE.id}
                handleHoverPlace={jest.fn()}
                setPopup={jest.fn()}
            />
        </NextIntlClientProvider>,
    );
    return { ...result, setCardToExpand };
}

describe('<ServiceCard /> — link „Zobacz profil”', () => {
    it('pl: link do /firma/<slug> bez prefiksu locale', () => {
        renderExpandedCard('pl');

        expect(screen.getByRole('link', { name: 'Zobacz profil' })).toHaveAttribute(
            'href',
            '/firma/x',
        );
    });

    it.each(['uk', 'ru'] as const)('%s: wlasny prefiks locale, nigdy /en', locale => {
        renderExpandedCard(locale);

        const href = screen.getByRole('link', { name: MESSAGES[locale].MapCard.viewProfile })
            .getAttribute('href');
        expect(href).toBe(`/${locale}/firma/x`);
        expect(href).not.toMatch(/^\/en\//);
    });

    it('en: prefiks /en', () => {
        renderExpandedCard('en');

        expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute(
            'href',
            '/en/firma/x',
        );
    });

    it('klikniecie linku nie zwija karty', () => {
        const { setCardToExpand } = renderExpandedCard('pl');

        fireEvent.click(screen.getByRole('link', { name: 'Zobacz profil' }));

        expect(setCardToExpand).not.toHaveBeenCalled();
    });

    it('przechodzi asercje jest-axe z linkiem do profilu', async () => {
        const { container } = renderExpandedCard('pl');

        expect(await axe(container)).toHaveNoViolations();
    });
});
