import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://polvia.com';

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
                '*.pdf$',
            ],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
