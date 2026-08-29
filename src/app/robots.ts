import { MetadataRoute } from 'next';
import { env } from '../../env';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = env.NEXT_PUBLIC_SITE_URL;

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
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
