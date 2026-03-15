'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, CalendarIcon } from 'lucide-react';
import { ImageField, PostMetadata } from '@/types';
import { Link } from '@/i18n/navigation';

// interface PostMetadata {
//     slug: string;
//     locale: string;
//     title: string;
//     summary: string;
//     author: string;
//     publishedAt: string;
//     coverImage?: string;
//     image?: string;
//     tags?: string[];
// }

interface BlogSectionClientProps {
    post: PostMetadata | null;
    locale: string;
}
export function BlogSectionClient({ post, locale }: BlogSectionClientProps) {
    const t = useTranslations('Blog');
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    if (!post) {
        return null;
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        try {
            return new Date(dateString).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch {
            return dateString;
        }
    };

    const getAuthorInitials = (author?: string) => {
        if (!author) return 'AU';
        return author
            .split(' ')
            .map(name => name.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getCategoryFromTags = (tags?: string[]) => {
        if (!tags || tags.length === 0) return t('defaultCategory') || 'Article';
        return tags[0];
    };

    const getImageUrl = () => {
        const coverImage = post.coverImage;
        const image = post.image;

        let imageUrl = '';
        if (typeof coverImage === 'string' && coverImage) {
            imageUrl = coverImage;
        } else if (typeof image === 'string' && image) {
            imageUrl = image;
        } else if (coverImage && typeof coverImage === 'object' && 'src' in coverImage) {
            imageUrl = coverImage.src;
        } else if (image && typeof image === 'object' && 'src' in image) {
            imageUrl = image.src;
        }

        if (imageUrl && !imageUrl.startsWith('/') && !imageUrl.startsWith('http')) {
            imageUrl = '/' + imageUrl;
        }

        return imageUrl;
    };

    const getImageAlt = () => {
        const image = post.image;
        const coverImage = post.coverImage;

        if (image && typeof image === 'object' && 'alt' in image) {
            return image.alt;
        }
        if (coverImage && typeof coverImage === 'object' && 'alt' in coverImage) {
            return coverImage.alt;
        }
        return post.title;
    };

    const handleImageLoad = () => setImageLoaded(true);
    const handleImageError = () => {
        setImageError(true);
        setImageLoaded(true);
    };

    const imageUrl = getImageUrl();
    const imageAlt = getImageAlt();

    return (
        <section className="w-full bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto max-w-4xl px-4 py-16 lg:px-8 lg:pb-16 lg:pt-8">
                {/* Section Header */}
                <div className="mb-12 text-center">
                    <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
                        {t('latestOn')}{' '}
                        {/*<Link className="text-green" href="/blog">*/}
                        {/*    {t('blog')}*/}
                        {/*</Link>*/}
                        {/*<span className="text-green dark:text-green">Blog</span>*/}
                    </h2>
                    <p className="mx-auto max-w-2xl text-base text-gray-600 dark:text-gray-300 lg:text-lg">
                        {t('subtitle')}
                    </p>
                </div>

                {/* Featured Article Card - Cleaner Layout */}
                <article className="group overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-gray-800">

                    {/* Image Section */}
                    <div className="relative aspect-[2/1] overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {imageUrl && !imageError ? (
                            <>
                                {/* Loading skeleton */}
                                {!imageLoaded && (
                                    <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-600" />
                                )}

                                <Image
                                    src={imageUrl}
                                    alt={imageAlt || ""}
                                    fill
                                    className={`object-cover transition-all duration-500 group-hover:scale-105 ${
                                        imageLoaded ? 'opacity-100' : 'opacity-0'
                                    }`}
                                    priority
                                    onLoad={handleImageLoad}
                                    onError={handleImageError}
                                />
                            </>
                        ) : (
                            // Clean fallback gradient
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-green to-green">
                                <div className="text-center text-white">
                                    <div className="mb-3 text-5xl">📖</div>
                                    <p className="text-lg font-semibold">{t('articlePreview') || 'Artykuł'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Content Section */}
                    <div className="p-6 lg:p-8">

                        {/* Category Badge */}
                        {post.tags && post.tags.length > 0 && (
                            <div className="mb-4">
                                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green dark:bg-green/30 dark:text-green">
                                    {getCategoryFromTags(post.tags)}
                                </span>
                            </div>
                        )}

                        {/* Article Title */}
                        <h3 className="mb-4 text-2xl font-bold leading-tight text-gray-900 dark:text-white lg:text-3xl">
                            {post.title}
                        </h3>

                        {/* Article Summary */}
                        <p className="mb-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
                            {post.summary}
                        </p>

                        {/* Article Meta */}
                        <div className="mb-6 flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">

                            {/* Author */}
                            {post.author && (
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-full bg-green text-sm font-semibold text-white">
                                        {getAuthorInitials(post.author)}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {post.author}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('author') || 'Autor'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Publication Date */}
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="size-4" />
                                <span>{formatDate(post.publishedAt)}</span>
                            </div>

                            {/*/!* Reading Time *!/*/}
                            {/*{post.readingTime && (*/}
                            {/*    <div className="flex items-center gap-2">*/}
                            {/*        <ClockIcon className="h-4 w-4" />*/}
                            {/*        <span>{post.readingTime} {t('minRead') || 'min czytania'}</span>*/}
                            {/*    </div>*/}
                            {/*)}*/}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-4">
                            <Link
                                 // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-expect-error
                                href={`/blog/${post.slug}`}
                                className="inline-flex items-center gap-2 rounded-lg bg-green px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-green focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                            >
                                {t('readFullArticle')}
                                <ArrowRightIcon className="size-4" />
                            </Link>

                            <Link
                                href="/blog"
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
                            >
                                {t('viewAllArticles')}
                            </Link>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    );
}