import { existsSync } from 'node:fs';
import path from 'node:path';

import {
    getActionHrefs,
    getSocialLinks,
} from '@/app/[locale]/firma/[slug]/_components/profile-helpers';
import { locales } from '@/i18n/config';
import { PREMIUM_TEMPLATES } from '@/lib/premium-templates';

import {
    DEFAULT_EXAMPLE_TEMPLATE,
    EXAMPLE_IMAGES_DIR,
    getPremiumExampleProfile,
    parseExampleTemplate,
} from './premium-example-profile';

function exampleImageSources(): string[] {
    const profile = getPremiumExampleProfile('pl', 'gallery');

    return [
        profile.logo,
        profile.premium.coverImage?.src,
        ...profile.premium.gallery.map(image => image.src),
    ].flatMap(src => (src ? [src] : []));
}

describe('parseExampleTemplate', () => {
    it.each(PREMIUM_TEMPLATES)('przyjmuje znany szablon %p', template => {
        expect(parseExampleTemplate(template)).toBe(template);
    });

    it.each([
        ['brak parametru', undefined],
        ['nieznana wartosc', 'luxury'],
        ['pusta wartosc', ''],
        ['inna wielkosc liter', 'Gallery'],
        ['powtorzony parametr', ['classic', 'gallery']],
    ])('%s daje domyslny szablon', (_, value) => {
        expect(parseExampleTemplate(value)).toBe(DEFAULT_EXAMPLE_TEMPLATE);
    });
});

describe('getPremiumExampleProfile', () => {
    it.each(locales)('%s: wszystkie sekcje premium wypelnione, w wybranym szablonie', locale => {
        const profile = getPremiumExampleProfile(locale, 'classic');

        expect(profile.premium.template).toBe('classic');
        expect(profile.description).toBeTruthy();
        expect(profile.premium.coverImage).not.toBeNull();
        expect(profile.premium.gallery.length).toBeGreaterThan(0);
        expect(profile.premium.priceList.length).toBeGreaterThan(0);
        expect(profile.premium.faq.length).toBeGreaterThan(0);
        expect(profile.premium.ratings.length).toBeGreaterThan(0);
        expect(profile.locations[0]?.openingHours).not.toEqual({});
        expect(profile.premium.gallery.every(image => image.alt.trim() !== '')).toBe(true);
    });

    it('logo i zdjecia tylko z katalogu przykladu, nie z katalogu firm (public/services)', () => {
        const sources = exampleImageSources();

        // logo + okladka + co najmniej jedno zdjecie galerii
        expect(sources.length).toBeGreaterThanOrEqual(3);
        expect(sources.every(src => src.startsWith(`${EXAMPLE_IMAGES_DIR}/`))).toBe(true);
    });

    it('kazdy plik logo i zdjec istnieje w public/', () => {
        const missing = exampleImageSources().filter(
            src => !existsSync(path.join(process.cwd(), 'public', src)),
        );

        expect(missing).toEqual([]);
    });

    it('logo jest wektorowe (SVG), nie zastepczym /default.png', () => {
        const { logo } = getPremiumExampleProfile('pl', 'gallery');

        expect(logo).toBe(`${EXAMPLE_IMAGES_DIR}/kolumna-logo.svg`);
    });

    it.each(locales)('%s: kazde zdjecie galerii ma wlasny opis alt', locale => {
        const { gallery } = getPremiumExampleProfile(locale, 'gallery').premium;
        const alts = gallery.map(image => image.alt);

        expect(alts.every(alt => typeof alt === 'string' && alt.trim() !== '')).toBe(true);
        expect(new Set(alts).size).toBe(gallery.length);
    });

    it('kontakt i linki ocen nie prowadza do nikogo prawdziwego', () => {
        const profile = getPremiumExampleProfile('pl', 'gallery');
        const [location] = profile.locations;

        expect(location?.email).toMatch(/@example\.com$/);
        expect(location?.webpage).toBe('https://example.com');
        expect(location?.phoneNumber).toMatch(/^\+48 000/);
        expect(profile.mapHref).toBeNull();
        expect(
            profile.premium.ratings.every(rating => rating.url.startsWith('https://example.com/')),
        ).toBe(true);
    });

    it('przyciski naglowka: wszystkie akcje, tylko nieistniejacy numer i Plac Defilad', () => {
        const [location] = getPremiumExampleProfile('pl', 'gallery').locations;
        if (!location) throw new Error('Brak lokalizacji przykladu');

        expect(getActionHrefs(location, true)).toEqual({
            call: 'tel:+48 000 000 000',
            whatsapp: 'https://wa.me/48000000000',
            telegram: 'https://t.me/+48000000000',
            navigate: 'https://www.google.com/maps/dir/?api=1&destination=52.2316,21.0067',
        });
    });

    it('ikony sieci spolecznosciowych tylko na domene zarezerwowana', () => {
        const [location] = getPremiumExampleProfile('pl', 'gallery').locations;
        const links = getSocialLinks(location?.socials ?? null);

        expect(links.map(link => link.key)).toEqual(['facebook', 'instagram']);
        expect(links.every(link => link.href.startsWith('https://example.com/'))).toBe(true);
    });

    it('wspolrzedne wskazuja Plac Defilad w Warszawie (plac publiczny, nie firme)', () => {
        const [location] = getPremiumExampleProfile('pl', 'gallery').locations;

        expect(location?.latitude).toBeCloseTo(52.2316, 3);
        expect(location?.longitude).toBeCloseTo(21.0067, 3);
    });

    it.each(locales)('%s: okruszki linkuja tylko strone glowna, nie mape z filtrem', locale => {
        const { breadcrumbs } = getPremiumExampleProfile(locale, 'gallery');
        const hrefs = breadcrumbs.flatMap(crumb => (crumb.href ? [crumb.href] : []));

        expect(breadcrumbs).toHaveLength(4);
        expect(hrefs).toEqual([locale === 'pl' ? '/' : `/${locale}`]);
    });
});
