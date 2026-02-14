import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
    locales: ['pl', 'en'], // Put pl first
    defaultLocale: 'pl',
    localePrefix: 'as-needed', // This is key - allows pol.ie/ to serve Polish directly
    pathnames: {
        '/': '/',
        '/map': {
            en: '/map',
            pl: '/mapa',
        },
        '/contact': {
            en: '/contact',
            pl: '/kontakt',
        },
        '/blog': {
            en: '/blog',
            pl: '/blog',
        },
        '/terms': {
            en: '/terms',
            pl: '/regulamin',
        },
        '/cookies': {
            en: '/cookies',
            pl: '/ciasteczka',
        },
        '/pricing': {
            en: '/pricing',
            pl: '/cennik',
        },
    },
});

export type AppPathnames = keyof typeof routing.pathnames;
