import type { PremiumProfileView } from '@/app/[locale]/firma/[slug]/_components/service-profile-types';
import type { Locale } from '@/i18n/config';
import { PREMIUM_TEMPLATES, type PremiumTemplate } from '@/lib/premium-templates';

import { PREMIUM_EXAMPLE_TEXTS } from './premium-example-content';

/**
 * Fikcyjna firma przykladowej strony premium — niezalezna od bazy, nie trafia na mape,
 * do wynikow ani do sitemapy. Zdjecia to ilustracje z bloga (`public/images/blog/`):
 * nie sa logotypami ani zdjeciami zadnej firmy z katalogu. Kontakt nie trafia do nikogo:
 * numer `+48 000…` nie istnieje, a `example.com` jest domena zarezerwowana (RFC 2606).
 */

/** Query param przelacznika szablonow — ta sama nazwa we wszystkich locale (jak `?lang=`). */
export const EXAMPLE_TEMPLATE_PARAM = 'szablon';

/** Szablon bez parametru albo z nieznana wartoscia: pierwszy w przelaczniku. */
export const DEFAULT_EXAMPLE_TEMPLATE: PremiumTemplate = 'gallery';

const TEMPLATE_VALUES: ReadonlySet<string> = new Set(PREMIUM_TEMPLATES);

function isPremiumTemplate(value: string): value is PremiumTemplate {
    return TEMPLATE_VALUES.has(value);
}

/** Wartosc `?szablon=` z adresu; tablica (powtorzony parametr) i nieznana wartosc daja domyslny. */
export function parseExampleTemplate(value: string | string[] | undefined): PremiumTemplate {
    return typeof value === 'string' && isPremiumTemplate(value) ? value : DEFAULT_EXAMPLE_TEMPLATE;
}

const BLOG_IMAGES = '/images/blog';

const GALLERY_FILES = [
    `${BLOG_IMAGES}/ukraincy-pkb-polski/cover.png`,
    `${BLOG_IMAGES}/mapa-ukrainskich-firm-w-polsce/cover.png`,
    `${BLOG_IMAGES}/branze-ukrainskich-firm-w-polsce/cover.png`,
] as const;

const EXAMPLE_HOURS = {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '15:00' },
};

/** Fikcyjna firma w danym locale, w kontrakcie szablonow premium. */
export function getPremiumExampleProfile(
    locale: Locale,
    template: PremiumTemplate,
): PremiumProfileView {
    const texts = PREMIUM_EXAMPLE_TEXTS[locale];

    return {
        serviceId: '00000000-0000-4000-8000-000000000000',
        slug: 'przyklad',
        name: 'Kolumna — biuro rachunkowe',
        description: texts.description,
        logo: null,
        category: 'financial',
        coverage: 'hybrid',
        languages: ['pl', 'uk', 'ru', 'en'],
        tags: texts.tags,
        verified: false,
        locations: [
            {
                id: 'example-main',
                city: 'Warszawa',
                street: 'ul. Przykładowa 1',
                postcode: '00-000',
                voivodeship: 'mazowieckie',
                // Bez wspolrzednych: przycisk „Nawiguj” prowadzilby pod prawdziwy adres.
                latitude: null,
                longitude: null,
                phoneNumber: '+48 000 000 000',
                email: 'biuro@example.com',
                webpage: 'https://example.com',
                socials: null,
                whatsappNumber: null,
                openingHours: EXAMPLE_HOURS,
                isMainLocation: true,
            },
        ],
        mapHref: null,
        similarServices: [],
        premium: {
            template,
            coverImage: {
                src: `${BLOG_IMAGES}/ukrainskie-firmy-w-polsce/cover.jpg`,
                alt: texts.coverAlt,
            },
            gallery: GALLERY_FILES.map((src, index) => ({ src, alt: texts.galleryAlts[index] })),
            priceList: texts.priceList,
            faq: texts.faq,
            // Wartosci demonstracyjne; linki na domene zarezerwowana, nie do prawdziwych profili.
            ratings: [
                {
                    source: 'google',
                    name: 'Google',
                    rating: 4.9,
                    count: 87,
                    url: 'https://example.com/opinie-google',
                },
                {
                    source: 'facebook',
                    name: 'Facebook',
                    rating: 4.8,
                    count: 23,
                    url: 'https://example.com/opinie-facebook',
                },
            ],
        },
    };
}
