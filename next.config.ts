import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import createMDX from '@next/mdx';

const nextConfig: NextConfig = {
    pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
    trailingSlash: false,

    // CSS optimization for better performance - using stable features only

    // Production optimizations
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },

    async redirects() {
        return [
            // External domain redirects
            {
                source: '/www.polonez.ie',
                destination: 'https://www.polonez.ie',
                permanent: true,
            },
            {
                source: '/pl/www.polonez.ie',
                destination: 'https://www.polonez.ie',
                permanent: true,
            },
            {
                source: '/pl/www.waterford.orpeg.pl',
                destination: 'https://www.waterford.orpeg.pl',
                permanent: true,
            },
            {
                source: '/en/www.euro-fences.ie',
                destination: 'https://www.euro-fences.ie',
                permanent: true,
            },
            {
                source: '/pl/www.euro-fences.ie',
                destination: 'https://www.euro-fences.ie',
                permanent: true,
            },

            // Legacy /_/ map URLs → clean canonical URLs
            {
                source: '/mapa/_/:county',
                destination: '/mapa/:county',
                permanent: true,
            },
            {
                source: '/en/map/_/:county',
                destination: '/en/map/:county',
                permanent: true,
            },
            {
                source: '/mapa/_/:category/:county',
                destination: '/mapa/:category/:county',
                permanent: true,
            },
            {
                source: '/en/map/_/:category/:county',
                destination: '/en/map/:category/:county',
                permanent: true,
            },

            // Stale URLs reported as 404 by Google Search Console
            {
                source: '/year',
                destination: '/',
                permanent: true,
            },
            {
                source: '/month',
                destination: '/',
                permanent: true,
            },
            {
                source: '/miesi%C4%85c',
                destination: '/',
                permanent: true,
            },

            // Privacy and terms pages
            {
                source: '/en/privacy',
                destination: '/privacy',
                permanent: true,
            },
            {
                source: '/pl/privacy',
                destination: '/privacy',
                permanent: true,
            },
            {
                source: '/pl/terms',
                destination: '/terms',
                permanent: true,
            },
        ]
    },
};

// Configure MDX with proper options
const withMDX = createMDX({
    extension: /\.mdx?$/,
    options: {
        remarkPlugins: [],
        rehypePlugins: [],
            format: 'mdx',
        },
});

const withNextIntl = createNextIntlPlugin();

// Apply plugins in the correct order: NextIntl first, then MDX
export default withNextIntl(withMDX(nextConfig));