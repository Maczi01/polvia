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
        '/dashboard': '/dashboard',
        '/dashboard/services': '/dashboard/services',
        '/dashboard/services/new': '/dashboard/services/new',
    },
});

export type AppPathnames = keyof typeof routing.pathnames;
