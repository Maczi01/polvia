import type { PremiumProfileView } from '@/app/[locale]/firma/[slug]/_components/service-profile-types';
import type { Locale } from '@/i18n/config';
import { serviceNameFromCapitalLetter } from '@/lib/consts';
import { PREMIUM_TEMPLATES, type PremiumTemplate } from '@/lib/premium-templates';
import { buildHomePath, type ProfileBreadcrumb } from '@/lib/service-profile-breadcrumbs';

import { PREMIUM_EXAMPLE_TEXTS } from './premium-example-content';

/**
 * Fikcyjna firma przykladowej strony premium — niezalezna od bazy, nie trafia na mape,
 * do wynikow ani do sitemapy. Logo i zdjecia leza w `public/images/premium-example/`: logo
 * narysowane dla tej strony, zdjecia ze stocku (Unsplash) — nie sa logotypami ani zdjeciami
 * zadnej firmy z katalogu. Kontakt nie trafia do nikogo:
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

/** Katalog obrazkow fikcyjnej firmy w `public/` — nie `public/services` (katalog firm). */
export const EXAMPLE_IMAGES_DIR = '/images/premium-example';

/** Wlasny projekt (SVG) — `ProfileLogo` podaje sciezke wprost do `next/image`. */
const EXAMPLE_LOGO = `${EXAMPLE_IMAGES_DIR}/kolumna-logo.svg`;

/*
 * Zdjecia z Unsplash na Unsplash License (bez Unsplash+; licencja nie wymaga atrybucji —
 * zrodla dla porzadku). Pobrane z `images.unsplash.com/photo-<id>?w=1600&q=75&fm=jpg&fit=crop`
 * (okladka: w=1920&h=1080&q=70; stanowisko-pracy: q=70, zeby zmiescic sie w ~350 KB).
 * - biuro-open-space.jpg — Adolfo Félix,
 *   https://unsplash.com/photos/office-workspace-with-white-desks-PG8NyM_Mcts
 * - ksiegowa-przy-biurku.jpg — Vitaly Gariev,
 *   https://unsplash.com/photos/woman-working-with-documents-at-office-desk-Vvn0OD0IxBM
 * - konsultacja-z-klientem.jpg — Vitaly Gariev,
 *   https://unsplash.com/photos/business-people-signing-a-contract-at-a-table-iPheGw7_UaI
 * - spotkanie-zespolu.jpg — Vitaly Gariev,
 *   https://unsplash.com/photos/business-professionals-collaborating-around-a-conference-table-y7xUr3aDLXc
 * - kalkulator-i-raporty.jpg — Cht Gsml,
 *   https://unsplash.com/photos/desk-with-calculator-charts-and-pencil-dspKrJYp644
 * - stanowisko-pracy.jpg — Li Zhang,
 *   https://unsplash.com/photos/a-modern-and-bright-home-office-space-zWWhupBREII
 */
const COVER_PHOTO = `${EXAMPLE_IMAGES_DIR}/biuro-open-space.jpg`;

/** Kolejnosc zgodna z `galleryAlts` w `premium-example-content.ts`. */
const GALLERY_PHOTOS = [
    `${EXAMPLE_IMAGES_DIR}/ksiegowa-przy-biurku.jpg`,
    `${EXAMPLE_IMAGES_DIR}/konsultacja-z-klientem.jpg`,
    `${EXAMPLE_IMAGES_DIR}/spotkanie-zespolu.jpg`,
    `${EXAMPLE_IMAGES_DIR}/kalkulator-i-raporty.jpg`,
    `${EXAMPLE_IMAGES_DIR}/stanowisko-pracy.jpg`,
] as const;

const EXAMPLE_HOURS = {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '15:00' },
};

const EXAMPLE_NAME = 'Kolumna — biuro rachunkowe';
const EXAMPLE_CITY = 'Warszawa';

/**
 * Okruszki fikcyjnej firmy: link tylko do strony glownej. Kategoria i miasto bez linkow —
 * mapa z filtrem sugerowalaby, ze firma jest w katalogu. Bez JSON-LD (strona `noindex`).
 */
function buildExampleBreadcrumbs(locale: Locale, categoryLabel: string): ProfileBreadcrumb[] {
    return [
        { label: serviceNameFromCapitalLetter, href: buildHomePath(locale) },
        { label: categoryLabel, href: null },
        { label: EXAMPLE_CITY, href: null },
        { label: EXAMPLE_NAME, href: null },
    ];
}

/** Fikcyjna firma w danym locale, w kontrakcie szablonow premium. */
export function getPremiumExampleProfile(
    locale: Locale,
    template: PremiumTemplate,
): PremiumProfileView {
    const texts = PREMIUM_EXAMPLE_TEXTS[locale];

    return {
        serviceId: '00000000-0000-4000-8000-000000000000',
        slug: 'przyklad',
        name: EXAMPLE_NAME,
        description: texts.description,
        logo: EXAMPLE_LOGO,
        category: 'financial',
        coverage: 'hybrid',
        languages: ['pl', 'uk', 'ru', 'en'],
        tags: texts.tags,
        verified: false,
        locations: [
            {
                id: 'example-main',
                city: EXAMPLE_CITY,
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
        breadcrumbs: buildExampleBreadcrumbs(locale, texts.breadcrumbCategory),
        premium: {
            template,
            coverImage: { src: COVER_PHOTO, alt: texts.coverAlt },
            gallery: GALLERY_PHOTOS.map((src, index) => ({ src, alt: texts.galleryAlts[index] })),
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
