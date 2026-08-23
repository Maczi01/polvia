// app/sitemap.ts
import { MetadataRoute } from 'next';
import { getPosts } from '@/lib/posts';
import { CATEGORY_SLUGS, COUNTY_SLUGS, COVERAGE_ONLINE_SLUG } from '@/lib/slug-mappings';

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
    const blogLocales = [
        { locale: 'pl', prefix: '' },
        { locale: 'en', prefix: '/en' },
        { locale: 'ru', prefix: '/ru' },
        { locale: 'uk', prefix: '/uk' },
    ] as const;

    try {
        for (const { locale, prefix } of blogLocales) {
            const posts = await getPosts(locale);
            for (const post of posts) {
                blogPages.push({
                    url: `${baseUrl}${prefix}/blog/${post.slug}`,
                    lastModified: post.publishedAt
                        ? new Date(post.publishedAt).toISOString()
                        : currentDate,
                    changeFrequency: 'monthly',
                    priority: 0.7,
                });
            }
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

    // -------------------------------------------------------
    // 6. Usługi online — /mapa/online, /en/map/online
    //
    // Zasięg zajmuje ten sam slot ścieżki co województwo, więc trasa wygląda jak
    // strona lokalizacji: „prawne w całej Polsce" zamiast „prawne w Pomorskim".
    // Slug `online` jest identyczny we wszystkich locale.
    //
    // Priorytet wyżej niż kategorie (0.6): to jedna strona zbierająca całą podaż
    // zdalną, nie jeden z czternastu wycinków.
    //
    // Kombinacje {kategoria}/online POMINIĘTE świadomie — 14 × 2 locale to thin
    // content, dopóki większość kategorii ma zero usług zdalnych. Do dodania,
    // gdy pojawi się podaż, najlepiej gated licznikiem z bazy.
    // -------------------------------------------------------
    const onlinePages: MetadataRoute.Sitemap = [
        {
            url: `${baseUrl}/mapa/${COVERAGE_ONLINE_SLUG}`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/en/map/${COVERAGE_ONLINE_SLUG}`,
            lastModified: currentDate,
            changeFrequency: 'weekly',
            priority: 0.7,
        },
    ];

    // -------------------------------------------------------
    // 7. Łączymy wszystko
    // (Kombinacje category+county pominięte — zbyt wiele stron z thin content)
    // -------------------------------------------------------
    return [
        ...rootPages,
        ...staticPages,
        ...blogPages,
        ...onlinePages,
        ...categoryPages,
        ...countyPages,
    ];
}