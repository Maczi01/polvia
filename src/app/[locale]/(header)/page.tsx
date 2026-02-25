import React from 'react';
import HeroSection from '@/app/[locale]/(header)/_components/hero-section';
import { CategoryPreviewServer } from '@/app/[locale]/(header)/_components/category-preview-server';
import { PopularServices } from '@/app/[locale]/(header)/_components/popular-services';
import { Faq } from '@/app/[locale]/(header)/_components/faq';
import { StatsBar } from './_components/stats-bar';
import { HowItWorks } from '@/app/[locale]/(header)/_components/how-it-works';
import ScrollToTopButton from '@/app/[locale]/(header)/_components/scroll-to-top-button';
import { BlogSection } from './_components/blog-section';

export default async function HomePage({ params }: { params: any }) {
    return (
        <div className="flex flex-col">
            <HeroSection />
            <HowItWorks />
            <CategoryPreviewServer />
            <PopularServices params={params} />
            <StatsBar />
            <Faq />
            {/*<BlogSection params={params} />*/}
            <ScrollToTopButton />
        </div>
    );
}
