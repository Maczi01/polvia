import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import type { PartialService } from '@/types';

import pl from '../../../../../messages/pl.json';
import uk from '../../../../../messages/uk.json';
import { MarkerPopup } from './marker-popup';

expect.extend(toHaveNoViolations);

// Popup Mapboxa wymaga instancji mapy — zastepujemy go samym kontenerem tresci.
jest.mock('react-map-gl/mapbox', () => ({
    Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// Prawdziwy routing next-intl; zastepujemy tylko hooki App Routera.
jest.mock('next/navigation', () => ({
    usePathname: () => '/',
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    useParams: () => ({}),
    redirect: jest.fn(),
    permanentRedirect: jest.fn(),
}));

const MESSAGES = { pl, uk };

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
    street: null,
    voivodeship: 'mazowieckie',
    postcode: null,
    latitude: 52.2297,
    longitude: 21.0122,
    openingHours: {},
    phoneNumber: null,
    email: null,
    webpage: null,
    image: 'logo.png',
    languages: ['pl'],
    socials: null,
    whatsappNumber: null,
    verified: false,
};

function renderPopup(locale: keyof typeof MESSAGES, service: PartialService = SERVICE) {
    return render(
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Warsaw">
            <MarkerPopup
                latitude={52.2297}
                longitude={21.0122}
                name={service.name}
                image="/services/logo.png"
                place="Warszawa"
                category="renovation"
                onClose={jest.fn()}
                isMobile={false}
                selectedService={service}
            />
        </NextIntlClientProvider>,
    );
}

describe('<MarkerPopup /> — link do profilu', () => {
    it('pl: link do /firma/<slug>', () => {
        renderPopup('pl');

        expect(screen.getByRole('link', { name: 'Zobacz profil' })).toHaveAttribute(
            'href',
            '/firma/x',
        );
    });

    it('uk: link z prefiksem /uk, nie /en', () => {
        renderPopup('uk');

        expect(screen.getByRole('link', { name: uk.Popup.viewProfile })).toHaveAttribute(
            'href',
            '/uk/firma/x',
        );
    });

    it('wpis bez slugu uslugi nie ma linku do profilu', () => {
        renderPopup('pl', { ...SERVICE, serviceSlug: null });

        expect(screen.queryByRole('link', { name: 'Zobacz profil' })).not.toBeInTheDocument();
    });

    it('przechodzi asercje jest-axe', async () => {
        const { container } = renderPopup('pl');

        expect(await axe(container)).toHaveNoViolations();
    });
});
