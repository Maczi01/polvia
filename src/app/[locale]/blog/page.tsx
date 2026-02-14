// app/[locale]/blog/page.tsx
import { Metadata } from 'next';
import { getPosts } from '@/lib/posts';
import PostsWithSearch from './_components/posts-with-search';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { env } from '../../../../env';
import { imgSrc } from '@/lib/utilities';

export async function generateMetadata({
                                           params,
                                       }: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations('Blog');
    setRequestLocale(locale);

    const baseUrl = env.NEXT_PUBLIC_SITE_URL || 'https://www.pol.ie';

    // pull latest post for OG/Twitter image
    const posts = await getPosts(locale);
    const latest = posts[0];
    const ogCandidate =
        (latest && (imgSrc(latest.image) || imgSrc(latest.coverImage))) || undefined;
    const ogAbs =
        ogCandidate && (ogCandidate.startsWith('http') ? ogCandidate : `${baseUrl}${ogCandidate}`);

    return {
        title: t('metaTitle'),
        description: t('metaDescription'),
        alternates: {
            canonical: `${baseUrl}/${locale}/blog`,
            languages: {
                'x-default': `${baseUrl}/pl/blog`,
                en: `${baseUrl}/en/blog`,
                pl: `${baseUrl}/pl/blog`,
            },
        },
        openGraph: {
            title: t('metaTitle'),
            description: t('metaDescription'),
            url: `${baseUrl}/${locale}/blog`,
            type: 'website',
            locale,
            alternateLocale: locale === 'en' ? 'pl' : 'en',
            images: ogAbs
                ? [
                    {
                        url: ogAbs,
                        width: 1200,
                        height: 630,
                        alt: latest?.title ?? t('metaTitle'),
                    },
                ]
                : undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: t('metaTitle'),
            description: t('metaDescription'),
            images: ogAbs ? [ogAbs] : undefined,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
            },
        },
    };
}

type BlogPageProps = {
    params: Promise<{ locale: string }>;
};

export default async function BlogPage({ params }: BlogPageProps) {
    const { locale } = await params;
    const t = await getTranslations('Blog');
    setRequestLocale(locale);

    try {
        const posts = await getPosts(locale);

        console.log('Fetched Posts:', posts);  // Check if English posts are being fetched

        const translations = {
            searchPlaceholder: t('searchPlaceholder'),
            noPostsFound: t('noPostsFound'),
            readMore: t('readMore'),
        };

        if (posts.length === 0) {
            console.log('No posts found for this locale');  // Debugging line
        }

        return (
            <section className="py-2 sm:py-2">
                <div className="container mx-auto max-w-5xl px-4 sm:px-6">
                    <header className="mb-12 text-center">
                        <h1 className="mb-2 text-3xl font-bold">{t('title')}</h1>
                        <p className="text-muted-foreground">{t('subtitle')}</p>
                    </header>

                    {posts.length > 0 ? (
                        <PostsWithSearch posts={posts} locale={locale} translations={translations} />
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">{t('noPostsFound')}</p>
                        </div>
                    )}
                </div>
            </section>
        );
    } catch (error) {
        console.error('Error loading blog posts:', error);

        return (
            <section className="py-16 sm:py-24">
                <div className="container mx-auto max-w-5xl px-4 sm:px-6">
                    <header className="mb-12 text-center">
                        <h1 className="mb-2 text-3xl font-bold">{t('title')}</h1>
                        <p className="text-muted-foreground">{t('subtitle')}</p>
                    </header>

                    <div className="text-center py-12">
                        <p className="text-muted-foreground">
                            {t('errorLoadingPosts') || 'Error loading posts. Please try again later.'}
                        </p>
                    </div>
                </div>
            </section>
        );
    }
}
