// app/[locale]/blog/[slug]/page.tsx
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAvailableTranslations, getPostBySlug, getPosts } from '@/lib/posts';
import { ArrowLeftIcon, Calendar, Clock, Globe, User } from 'lucide-react';
import { formatDate, serviceNameFromCapitalLetter } from '@/lib/consts';
import { MDXContent } from '@/app/[locale]/blog/_components/mdx-content';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { env } from '../../../../../env';
import { imgAlt, imgSrc } from '@/lib/utilities';

export const dynamicParams = false;

type Params = { locale: string; slug: string };

export async function generateStaticParams() {
    const locales = ['en', 'pl', 'ru', 'uk'] as const;
    const allParams: Params[] = [];

    for (const locale of locales) {
        const posts = await getPosts(locale);
        for (const post of posts) {
            allParams.push({ locale, slug: post.slug });
        }
    }

    return allParams;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { locale, slug } = await params;
    setRequestLocale(locale);

    try {
        const post = await getPostBySlug(slug, locale);

        if (!post) {
            return {
                title: 'Post Not Found',
                robots: { index: false, follow: false },
            };
        }

        const baseUrl = env.NEXT_PUBLIC_SITE_URL;
        const postUrl = `${baseUrl}/${locale}/blog/${slug}`;

        const allLocales = ['pl', 'en', 'ru', 'uk'] as const;
        const languagesMap: Record<string, string> = {
            ...Object.fromEntries(allLocales.map(l => [l, `${baseUrl}/${l}/blog/${slug}`])),
            'x-default': baseUrl,
        };

        const ogImg = imgSrc(post.metadata.image) || imgSrc(post.metadata.coverImage);
        const ogImgAbs = ogImg
            ? ogImg.startsWith('http')
                ? ogImg
                : `${baseUrl}${ogImg}`
            : undefined;

        return {
            title: post.metadata.title,
            description: post.metadata.summary || post.metadata.title,
            authors: post.metadata.author ? [{ name: post.metadata.author }] : undefined,

            alternates: {
                canonical: postUrl,
                languages: languagesMap,
            },

            openGraph: {
                title: post.metadata.title,
                description: post.metadata.summary || post.metadata.title,
                url: postUrl,
                type: 'article',
                locale,
                siteName: serviceNameFromCapitalLetter,
                publishedTime: post.metadata.publishedAt,
                authors: post.metadata.author ? [post.metadata.author] : undefined,
                images: ogImgAbs
                    ? [
                        {
                            url: ogImgAbs,
                            width: 1200,
                            height: 630,
                            alt: post.metadata.title,
                        },
                    ]
                    : undefined,
            },

            twitter: {
                card: 'summary_large_image',
                title: post.metadata.title,
                description: post.metadata.summary || post.metadata.title,
                images: ogImgAbs ? [ogImgAbs] : undefined,
            },

            robots: {
                index: true,
                follow: true,
                googleBot: {
                    index: true,
                    follow: true,
                    'max-image-preview': 'large',
                    'max-snippet': -1,
                },
            },
        };
    } catch (error) {
        console.error('Error generating metadata for blog post:', error);
        return {
            title: 'Error Loading Post',
            robots: { index: false, follow: false },
        };
    }
}

type PostPageProps = { params: Promise<Params> };

const translations = {
    en: { backToPosts: 'Back to Posts', readingTime: 'min read' },
    pl: { backToPosts: 'Powrót do postów', readingTime: 'min czytania' },
    ru: { backToPosts: 'Назад к статьям', readingTime: 'мин чтения' },
    uk: { backToPosts: 'Назад до статей', readingTime: 'хв читання' },
};

function calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}

export default async function Post({ params }: PostPageProps) {
    const { locale, slug } = await params;
    setRequestLocale(locale);

    try {
        const post = await getPostBySlug(slug, locale);
        if (!post) notFound();

        const { metadata, content } = post;
        const { title, coverImage, image, author, publishedAt, summary } = metadata;
        const availableTranslations = await getAvailableTranslations(slug);
        const t = translations[locale as keyof typeof translations] || translations.en;
        const readingTime = calculateReadingTime(content);

        // Structured data for SEO
        const ogImg = imgSrc(image) || imgSrc(coverImage);
        const structuredData = {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: title,
            description: summary || title,
            author: { '@type': 'Person', name: author || 'Anonymous' },
            datePublished: publishedAt,
            image: ogImg
                ? ogImg.startsWith('http')
                    ? ogImg
                    : `${env.NEXT_PUBLIC_SITE_URL}${ogImg}`
                : undefined,
            publisher: {
                '@type': 'Organization',
                name: serviceNameFromCapitalLetter,
                logo: { '@type': 'ImageObject', url: `${env.NEXT_PUBLIC_SITE_URL}/favicon.ico` },
            },
            mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `${env.NEXT_PUBLIC_SITE_URL}/${locale}/blog/${slug}`,
            },
        };

        const hero = imgSrc(metadata.coverImage) || imgSrc(metadata.image); // ⬅️ fallback
        const toTag = (t: string) => `/${locale}/blog?tag=${encodeURIComponent(t)}`;


        return (
            <>
                {/* Structured Data */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />

                <article className="min-h-screen">
                    {/* Hero Section */}
                    <div className="relative overflow-hidden pb-2 pt-4 sm:pb-16 sm:pt-24">
                        <div className="bg-grid-pattern absolute inset-0 opacity-5" />

                        <div className="container relative mx-auto max-w-4xl px-4 sm:px-6">
                            {/* Navigation */}
                            <div className="mb-8 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-center sm:justify-between">
                                <Link
                                    href={`/${locale}/blog`}
                                    className="group inline-flex w-fit items-center gap-3 rounded-full bg-green px-4 py-2.5 text-sm
                  font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-green-800
                  hover:text-white hover:shadow-md"
                                >
                                    <ArrowLeftIcon className="size-4 transition-transform group-hover:-translate-x-1" />
                                    <span>{t.backToPosts}</span>
                                </Link>

                                {availableTranslations.length > 1 && (
                                    <div className="flex w-fit items-center gap-3 rounded-full bg-background/80 p-2 backdrop-blur-sm sm:ml-auto">
                                        <Globe className="size-4 text-muted-foreground" />
                                        <div className="flex gap-1">
                                            {availableTranslations.map((l) => (
                                                <Link
                                                    key={l}
                                                    href={`/${l}/blog/${slug}`}
                                                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                                                        l === locale
                                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    }`}
                                                >
                                                    {l.toUpperCase()}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Article Header */}
                            <header className="space-y-4 pb-2 text-center sm:space-y-6">
                                <div className="space-y-3 sm:space-y-4">
                                    <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
                                        {title}
                                    </h1>

                                    {summary && (
                                        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl">
                                            {summary}
                                        </p>
                                    )}
                                </div>

                                {/* Meta Information */}
                                <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-6">
                                    {author && (
                                        <div className="flex items-center justify-center gap-2">
                                            <User className="size-4" />
                                            <span className="font-medium">{author}</span>
                                        </div>
                                    )}

                                    {publishedAt && (
                                        <div className="flex items-center justify-center gap-2">
                                            <Calendar className="size-4" />
                                            <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-center gap-2">
                                        <Clock className="size-4" />
                                        <span>
                      {readingTime} {t.readingTime}
                    </span>
                                    </div>
                                </div>
                            </header>
                            {Array.isArray(metadata.tags) && metadata.tags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: '20px' }}>
                                    {metadata.tags.map((t) => (
                                        <Link
                                            key={t}
                                            href={toTag(t)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: 999,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                background: 'rgba(255,255,255,0.92)',
                                                color: '#0b1220',
                                                border: '1px solid rgba(0,0,0,0.06)',
                                            }}
                                        >
                                            #{t}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>



                    {/* Featured Image (coverImage) */}
                    {hero && (
                        <div className="container mx-auto max-w-5xl px-4 pt-1 sm:px-6">
                            <figure className="relative -mt-4 mb-8 aspect-video w-full overflow-hidden rounded-lg border bg-muted shadow-xl sm:-mt-8 sm:mb-12 sm:rounded-xl sm:shadow-2xl">
                                <Image
                                    src={hero}
                                    alt={imgAlt(coverImage, title || '')}
                                    className="object-cover transition-transform duration-300 hover:scale-105"
                                    fill
                                    priority
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                                />
                            </figure>
                        </div>
                    )}

                    {/* Content */}
                    <div className="container mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-24">
                        <div className="prose prose-base mx-auto max-w-none dark:prose-invert sm:prose-lg prose-headings:mb-4 prose-headings:mt-8 prose-headings:font-bold prose-headings:tracking-tight prose-p:mb-4 prose-p:leading-7 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-blockquote:my-6 prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:px-4 prose-blockquote:py-3 prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-muted prose-pre:p-4 prose-ol:space-y-2 prose-ul:space-y-2 prose-li:my-1">
                            <MDXContent source={content} />
                        </div>

                        {/* Article Footer */}
                        <div className="mt-12 border-t pt-6 sm:mt-16 sm:pt-8">
                            <div className="text-center">
                                <Link
                                    href={`/${locale}/blog`}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
                                >
                                    <ArrowLeftIcon className="size-4" />
                                    {t.backToPosts}
                                </Link>
                            </div>
                        </div>
                    </div>
                </article>
            </>
        );
    } catch (error) {
        console.error('Error loading blog post:', error);
        notFound();
    }
}
