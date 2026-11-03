import { locales } from '@/i18n/config';
import { PREMIUM_TEMPLATES } from '@/lib/premium-templates';

import {
    DEFAULT_EXAMPLE_TEMPLATE,
    getPremiumExampleProfile,
    parseExampleTemplate,
} from './premium-example-profile';

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

    it('zdjecia tylko ze stockowych zdjec przykladu, nie z katalogu firm (public/services)', () => {
        const { premium } = getPremiumExampleProfile('pl', 'gallery');
        const sources = [premium.coverImage?.src, ...premium.gallery.map(image => image.src)];

        expect(sources.every(src => src?.startsWith('/images/premium-example/'))).toBe(true);
        expect(sources.some(src => src?.includes('/services/'))).toBe(false);
    });

    it('kontakt i linki ocen nie prowadza do nikogo prawdziwego', () => {
        const profile = getPremiumExampleProfile('pl', 'gallery');
        const [location] = profile.locations;

        expect(location?.email).toMatch(/@example\.com$/);
        expect(location?.webpage).toBe('https://example.com');
        expect(location?.phoneNumber).toMatch(/^\+48 000/);
        expect(location?.latitude).toBeNull();
        expect(profile.mapHref).toBeNull();
        expect(
            profile.premium.ratings.every(rating => rating.url.startsWith('https://example.com/')),
        ).toBe(true);
    });

    it.each(locales)('%s: okruszki linkuja tylko strone glowna, nie mape z filtrem', locale => {
        const { breadcrumbs } = getPremiumExampleProfile(locale, 'gallery');
        const hrefs = breadcrumbs.flatMap(crumb => (crumb.href ? [crumb.href] : []));

        expect(breadcrumbs).toHaveLength(4);
        expect(hrefs).toEqual([locale === 'pl' ? '/' : `/${locale}`]);
    });
});
