import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.polvia.pl';

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                // Block query parameter URLs (these redirect to slug-based URLs)
                '/map?*',
                '/mapa?*',
                '/en/map?*',
                // Block sensitive paths
                '/api/',
                '/_next/',
                '/admin/',
                '/dashboard/',
                '*.pdf$',
            ],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
