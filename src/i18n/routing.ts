import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['pl', 'en', 'ru', 'uk'], // Put pl first
    defaultLocale: 'pl',
    localePrefix: 'as-needed', // This is key - allows pol.ie/ to serve Polish directly
    pathnames: {
        '/': '/',
        '/map': {
            en: '/map',
            pl: '/mapa',
            ru: '/map',
            uk: '/map',
        },
        '/contact': {
            en: '/contact',
            pl: '/kontakt',
            ru: '/contact',
            uk: '/contact',
        },
        '/blog': {
            en: '/blog',
            pl: '/blog',
            ru: '/blog',
            uk: '/blog',
        },
        '/terms': {
            en: '/terms',
            pl: '/regulamin',
            ru: '/terms',
            uk: '/terms',
        },
        '/cookies': {
            en: '/cookies',
            pl: '/ciasteczka',
            ru: '/cookies',
            uk: '/cookies',
        },
        '/pricing': {
            en: '/pricing',
            pl: '/cennik',
            ru: '/pricing',
            uk: '/pricing',
        },
        '/add-business': {
            en: '/add-business',
            pl: '/dodaj-firme',
            ru: '/add-business',
            uk: '/add-business',
        },
        // Profil firmy: ten sam segment `firma` we wszystkich locale (adres z outreachu).
        '/firma/[slug]': '/firma/[slug]',
        '/dashboard': '/dashboard',
        '/dashboard/services': '/dashboard/services',
        '/dashboard/services/new': '/dashboard/services/new',
    },
});

/**
 * Trasy bez segmentow dynamicznych — te, ktore nawigacja przyjmuje jako sam `pathname`.
 * Trasa z `[param]` (np. `/firma/[slug]`) wymaga `{ pathname, params }`, wiec nie moze
 * byc celem rzutowan `as AppPathnames` w naglowku i przelaczniku jezyka.
 */
export type AppPathnames = Exclude<keyof typeof routing.pathnames, `${string}[${string}`>;
