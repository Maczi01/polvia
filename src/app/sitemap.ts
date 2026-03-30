// app/sitemap.ts
import { MetadataRoute } from 'next';
import { getPosts } from '@/lib/posts';
import { getAllActiveServiceLocationSlugs } from '@/lib/seo-queries';
import {
    CATEGORY_SLUGS,
    COUNTY_SLUGS,
    CITY_SLUGS,
    CATEGORY_KEYS,
} from '@/lib/slug-mappings';
import { locales, defaultLocale } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.polvia.pl';
    const currentDate = new Date().toISOString();

    // -------------------------------------------------------
    // 1. Strona główna (PL = defaultLocale bez prefiksu)
    // -------------------------------------------------------
    const rootPages: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/`, // Polski - domyślny bez prefiksu
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/en`, // Angielski - z prefiksem
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 1,
        },
    ];

    // -------------------------------------------------------
    // 2. Statyczne strony
    // -------------------------------------------------------
    const staticPages: MetadataRoute.Sitemap = [
        // Mapy
        {
            url: `${baseUrl}/mapa`, // Polski bez prefiksu
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/en/map`, // Angielski z prefiksem
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.9,
        },

        // Kontakt
        {
            url: `${baseUrl}/kontakt`, // Polski bez prefiksu
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/en/contact`, // Angielski z prefiksem
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.8,
        },

        // Blog listing
        {
            url: `${baseUrl}/blog`, // Polski bez prefiksu
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/en/blog`, // Angielski z prefiksem
            lastModified: currentDate,
            changeFrequency: 'daily',
            priority: 0.9,
        },

        // Legal
        {
            url: `${baseUrl}/regulamin`, // Polski bez prefiksu
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/en/terms`, // Angielski z prefiksem
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/ciasteczka`, // Polski bez prefiksu
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/en/cookies`, // Angielski z prefiksem
            lastModified: currentDate,
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];

    // -------------------------------------------------------
    // 3. Posty blogowe
    // -------------------------------------------------------
    const blogPages: MetadataRoute.Sitemap = [];
    try {
        const plPosts = await getPosts('pl');
        for (const post of plPosts) {
            blogPages.push({
                url: `${baseUrl}/blog/${post.slug}`, // Polski bez prefiksu
                lastModified: post.publishedAt
                    ? new Date(post.publishedAt).toISOString()
                    : currentDate,
                changeFrequency: 'monthly',
                priority: 0.7,
            });
        }

        const enPosts = await getPosts('en');
        for (const post of enPosts) {
            blogPages.push({
                url: `${baseUrl}/en/blog/${post.slug}`, // Angielski z prefiksem
                lastModified: post.publishedAt
                    ? new Date(post.publishedAt).toISOString()
                    : currentDate,
                changeFrequency: 'monthly',
                priority: 0.7,
            });
        }
    } catch (error) {
        // Log error in production environment if needed
        if (process.env.NODE_ENV === 'development') {
            console.error('Error generating blog posts for sitemap:', error);
        }
    }

    // -------------------------------------------------------
    // 4. Kategorie map — /mapa/{category}, /en/map/{category}
    // -------------------------------------------------------
    const categoryKeys = Object.keys(CATEGORY_SLUGS.pl) as (keyof typeof CATEGORY_SLUGS.pl)[];

    const categoryPages: MetadataRoute.Sitemap = categoryKeys.flatMap(key => [
        {
            url: `${baseUrl}/mapa/${CATEGORY_SLUGS.pl[key]}`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/en/map/${CATEGORY_SLUGS.en[key]}`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.6,
        },
    ] as MetadataRoute.Sitemap);

    // -------------------------------------------------------
    // 5. County map — /mapa/{county}, /en/map/{county}
    // -------------------------------------------------------
    const countyPages: MetadataRoute.Sitemap = COUNTY_SLUGS.flatMap(county => [
        {
            url: `${baseUrl}/mapa/${county}`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/en/map/${county}`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.5,
        },
    ] as MetadataRoute.Sitemap);

    // Helper: build locale-prefixed URL
    const localeUrl = (locale: Locale, path: string) =>
        locale === defaultLocale ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`;

    // -------------------------------------------------------
    // 6. SEO — /firma/[slug] (location profile pages, all locales)
    // -------------------------------------------------------
    let firmaPages: MetadataRoute.Sitemap = [];
    try {
        const locations = await getAllActiveServiceLocationSlugs();
        firmaPages = locations.flatMap(loc =>
            locales.map(locale => ({
                url: localeUrl(locale, `/firma/${loc.slug}`),
                lastModified: loc.updatedAt
                    ? new Date(loc.updatedAt).toISOString()
                    : currentDate,
                changeFrequency: 'weekly' as const,
                priority: 0.7,
            })),
        );
    } catch (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Error generating firma pages for sitemap:', error);
        }
    }

    // -------------------------------------------------------
    // 7. SEO — /miasto/[city] (city landing pages, all locales)
    // -------------------------------------------------------
    const cityPages: MetadataRoute.Sitemap = CITY_SLUGS.flatMap(city =>
        locales.map(locale => ({
            url: localeUrl(locale, `/miasto/${city}`),
            lastModified: currentDate,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        })),
    );

    // -------------------------------------------------------
    // 8. SEO — /miasto/[city]/[category] (city + category pages, all locales)
    // -------------------------------------------------------
    const cityAndCategoryPages: MetadataRoute.Sitemap = CITY_SLUGS.flatMap(city =>
        locales.flatMap(locale =>
            CATEGORY_KEYS.map(key => ({
                url: localeUrl(locale, `/miasto/${city}/${CATEGORY_SLUGS[locale][key]}`),
                lastModified: currentDate,
                changeFrequency: 'weekly' as const,
                priority: 0.7,
            })),
        ),
    );

    // -------------------------------------------------------
    // 9. Łączymy wszystko
    // -------------------------------------------------------
    return [
        ...rootPages,
        ...staticPages,
        ...blogPages,
        ...categoryPages,
        ...countyPages,
        ...firmaPages,
        ...cityPages,
        ...cityAndCategoryPages,
    ];
}
