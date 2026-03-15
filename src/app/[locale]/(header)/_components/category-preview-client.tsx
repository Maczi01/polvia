'use client';
import { useTranslations, useLocale } from 'next-intl';
import { CategoryCard } from './category-card';
import { AppPathnames } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import { buildMapUrl } from '@/lib/map-url-builder';
import type { Locale } from '@/i18n/config';

type CategoryPreviewClientProps = {
    categories: {
        text: string;
        key: string;
        image: string;
        variant:
            | 'default'
            | 'red'
            | 'green'
            | 'orange'
            | 'blue'
            | 'gold'
            | 'violet'
            | 'aqua'
            | 'lightblue'
            | 'darkviolet'
            | 'starfall'
            | 'overworld'
            | 'oversky'
            | 'coral'
            | 'mojito'
            | 'removeFilter'
            | null
            | undefined;
    }[];
};

export function CategoryPreviewClient({ categories }: CategoryPreviewClientProps) {
    const t = useTranslations('Main');
    const tCategories = useTranslations('MapPage.Categories');
    const locale = useLocale() as Locale;
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Prevent hydration mismatch by showing skeleton until mounted
    if (!isMounted) {
        return (
            <section
                className="w-full bg-[#F1FAF4] dark:bg-gray-800"
                aria-labelledby="categories-heading"
            >
                <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <h2
                            id="categories-heading"
                            className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100"
                        >
                            {t('categories')}
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {Array.from({ length: categories.length }).map((_, index) => (
                            <div
                                key={index}
                                className="h-24 w-full animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700 sm:h-28 md:h-32"
                            />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section
            className="w-full bg-[#F1FAF4] dark:bg-gray-800"
            aria-labelledby="categories-heading"
        >
            <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h2
                        id="categories-heading"
                        className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-left"
                    >
                        {t('categories')}
                    </h2>
                </div>

                {/* Category Cards Grid */}
                <div className="relative">
                    <div
                        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                        role="region"
                        aria-label={`${t('categories')}`}
                    >
                        {categories.map((category, index) => {
                            // Build slug-based URL for category
                            const categoryUrl = buildMapUrl({ category: category.key }, locale);
                            return (
                                <CategoryCard
                                    key={`${category.text}-${index}`}
                                    hrefs={{
                                        pathname: categoryUrl.pathname as AppPathnames,
                                        query: categoryUrl.query,
                                    }}
                                    text={tCategories(category.text)}
                                    categoryKey={category.text}
                                    image={category.image}
                                    variant={category.variant}
                                    alt={t(`categoriesAlt.${category.text}`) || ''}
                                    className="h-24 w-full sm:h-28 md:h-32"
                                    aria-label={`${t('browserCompanies')} ${tCategories(category.text)}`}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="sr-only" aria-live="polite">
                    {`${categories.length} ${t('categoriesAvailable')}`}
                </div>
            </div>
        </section>
    );
}