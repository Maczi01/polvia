import React from 'react';
import HeroSection from '@/app/[locale]/(header)/_components/hero-section';
import { CategoryPreviewServer } from '@/app/[locale]/(header)/_components/category-preview-server';
import { PopularServices } from '@/app/[locale]/(header)/_components/popular-services';
import { Faq } from '@/app/[locale]/(header)/_components/faq';
import { PopularCities } from '@/app/[locale]/(header)/_components/popular-cities';
import { StatsBar } from './_components/stats-bar';
import { HowItWorks } from '@/app/[locale]/(header)/_components/how-it-works';
import ScrollToTopButton from '@/app/[locale]/(header)/_components/scroll-to-top-button';
import { BlogSection } from './_components/blog-section';
import { TrustSection } from '@/app/[locale]/(header)/_components/trust-section';
import { getVoivodeshipStats } from '@/lib/queries';

export default async function HomePage({ params }: { params: any }) {
    const voivodeshipStats = await getVoivodeshipStats();

    return (
        <div className="flex flex-col">
            <HeroSection voivodeshipStats={voivodeshipStats} />
            <HowItWorks />
            <CategoryPreviewServer />
            <PopularServices params={params} />
            <PopularCities />
            <TrustSection />
            <StatsBar />
            <Faq />
            {/*<BlogSection params={params} />*/}
            <ScrollToTopButton />
        </div>
    );
}
