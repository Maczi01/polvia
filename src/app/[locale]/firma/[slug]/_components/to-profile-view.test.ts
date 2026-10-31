import type { ServiceProfile, ServiceProfileLocation } from '@/lib/service-profile-queries';
import type { SimilarServiceRow } from '@/lib/similar-services';

import { toProfileView, toServiceImagePath } from './to-profile-view';

function location(overrides: Partial<ServiceProfileLocation> = {}): ServiceProfileLocation {
    return {
        id: 'loc-1',
        slug: 'mistrz-remontu-warszawa',
        city: 'Warszawa',
        street: 'ul. Grochowska 278',
        voivodeship: 'mazowieckie',
        postcode: '03-841',
        latitude: 52.2481,
        longitude: 21.0927,
        openingHours: { monday: { open: '08:00', close: '18:00' } },
        phoneNumber: '+48 600 100 200',
        email: null,
        webpage: null,
        socials: null,
        whatsappNumber: null,
        isMainLocation: true,
        ...overrides,
    };
}

function profile(overrides: Partial<ServiceProfile> = {}): ServiceProfile {
    return {
        id: 'service-1',
        slug: 'mistrz-remontu',
        name: 'Mistrz Remontu',
        description: 'Remonty',
        category: 'renovation',
        coverage: 'local',
        languages: ['pl', 'uk', 'de'],
        verified: true,
        image: 'remont.png  ',
        tags: ['Glazura'],
        locations: [location()],
        premiumContent: null,
        subscription: null,
        ...overrides,
    };
}

const similar: SimilarServiceRow[] = [
    {
        serviceId: 'service-2',
        slug: 'liga-remontu',
        name: 'Liga Remontu',
        image: null,
        city: 'Warszawa',
        category: 'renovation',
    },
];

describe('toServiceImagePath', () => {
    it('sklada sciezke /services/<plik> bez koncowych spacji', () => {
        expect(toServiceImagePath('logo.png ')).toBe('/services/logo.png');
    });

    it('brak obrazka daje null', () => {
        expect(toServiceImagePath(null)).toBeNull();
        expect(toServiceImagePath('  ')).toBeNull();
    });
});

describe('toProfileView', () => {
    it('mapuje logo i jezyki obslugi, a lokalizacje przekazuje z nazwami z bazy', () => {
        const view = toProfileView(profile(), similar, 'pl');

        expect(view.logo).toBe('/services/remont.png');
        expect(view.languages).toEqual(['pl', 'uk']);
        expect(view.locations[0]).toMatchObject({
            id: 'loc-1',
            isMainLocation: true,
            city: 'Warszawa',
        });
        expect(view.upgradeHref).toBe('/pricing');
        expect(view.premium).toBeNull();
    });

    it('przekazuje tresc premium z zapytania bez zmian', () => {
        const premiumContent: ServiceProfile['premiumContent'] = {
            template: 'professional',
            coverImage: { src: '/services/mistrz-remontu/cover.jpg', alt: 'Mistrz Remontu' },
            gallery: [],
            priceList: [],
            faq: [{ question: 'Czy dojezdzacie?', answer: 'Tak.' }],
        };

        const view = toProfileView(profile({ premiumContent }), similar, 'pl');

        expect(view.premium).toBe(premiumContent);
    });

    it('wpis bez obrazka ma logo null', () => {
        expect(toProfileView(profile({ image: null }), [], 'pl').logo).toBeNull();
    });

    it('mapHref wskazuje pin glownej lokalizacji na mapie', () => {
        const view = toProfileView(
            profile({
                coverage: 'hybrid',
                locations: [
                    location({ id: 'b', slug: 'filia', isMainLocation: false }),
                    location({ id: 'a', slug: 'centrala', isMainLocation: true }),
                ],
            }),
            [],
            'uk',
        );

        expect(view.mapHref).toEqual({ pathname: '/map', query: { place: 'centrala' } });
    });

    it('wpis online ma mapHref null', () => {
        expect(toProfileView(profile({ coverage: 'online' }), [], 'pl').mapHref).toBeNull();
    });

    it('lokalizacja bez wspolrzednych ma mapHref null', () => {
        const view = toProfileView(
            profile({ locations: [location({ latitude: null, longitude: null })] }),
            [],
            'pl',
        );

        expect(view.mapHref).toBeNull();
    });

    it('podobne firmy linkuja do /firma/[slug] z params', () => {
        const [first] = toProfileView(profile(), similar, 'pl').similarServices;

        expect(first.href).toEqual({ pathname: '/firma/[slug]', params: { slug: 'liga-remontu' } });
        expect(first.logo).toBeNull();
        expect(first.name).toBe('Liga Remontu');
    });
});
