import React from 'react';
import HeroSection from '@/app/[locale]/(header)/_components/hero-section';
import { CategoryPreviewServer } from '@/app/[locale]/(header)/_components/category-preview-server';
import { PopularServices } from '@/app/[locale]/(header)/_components/popular-services';
import { Faq } from '@/app/[locale]/(header)/_components/faq';
import { StatsBar } from './_components/stats-bar';
import { HowItWorks } from '@/app/[locale]/(header)/_components/how-it-works';
import ScrollToTopButton from '@/app/[locale]/(header)/_components/scroll-to-top-button';
import { BlogSection } from './_components/blog-section';
import { TrustSection } from '@/app/[locale]/(header)/_components/trust-section';
import { getCatalogStats, getFeaturedServices, getVoivodeshipStats } from '@/lib/queries';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const [voivodeshipStats, catalogStats, featuredServices] = await Promise.all([
        getVoivodeshipStats(),
        getCatalogStats(),
        getFeaturedServices(locale),
    ]);

    return (
        <div className="flex flex-col">
            <HeroSection voivodeshipStats={voivodeshipStats} />
            <HowItWorks />
            <CategoryPreviewServer />
            <PopularServices params={params} />
            <TrustSection
                companiesCount={catalogStats.companiesCount}
                featured={featuredServices}
            />
            <StatsBar
                companiesCount={catalogStats.companiesCount}
                citiesCount={catalogStats.citiesCount}
            />
            <Faq />
            <BlogSection params={params} />
            <ScrollToTopButton />
        </div>
    );
}
