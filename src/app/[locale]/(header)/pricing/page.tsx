'use client';

import React, { JSX, ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';

interface BadgeProps {
    children: ReactNode;
}

const Badge = ({ children }: BadgeProps) => (
    <span className="inline-block rounded-md bg-green px-2 py-1 font-sans text-xs font-semibold text-white dark:bg-green dark:text-white">{children}</span>
);

interface PriceCardProps {
    title: string;
    subtitle?: string;
    price: string;
    per: string;
    features: string[];
    cta: string;
    recommended: boolean;
}

const PriceCard = ({ title, subtitle, price, per, features, cta, recommended }: PriceCardProps) => {
    const t = useTranslations('Pricing');
    return (
        <div className={`min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${recommended ? "ring-2 ring-green dark:ring-green" : ""}`}>
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="font-sans text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="font-sans text-5xl font-extrabold text-[#26364d] dark:text-white">{price}</span>
                        <span className="font-sans text-lg text-gray-500 dark:text-gray-400">{per}</span>
                    </div>
                    {subtitle && <p className="mt-2 font-sans text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
                </div>
                {recommended && (
                    <div className="text-right">
                        <Badge>{t('recommended')}</Badge>
                    </div>
                )}
            </div>

            <div className="mt-6">
                <button className={`inline-flex items-center gap-2 rounded-full px-6 py-3 font-sans font-medium shadow-sm ${recommended ? 'bg-green text-white dark:bg-green dark:text-white' : 'bg-[#26364d] text-white dark:bg-gray-700 dark:text-white'}`}>
                    {cta}
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                </button>
            </div>

            <div className="mt-6">
                <h4 className="font-sans text-sm font-semibold text-gray-700 dark:text-gray-300">{t('whatsIncluded')}</h4>
                <ul className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    {features.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                            <svg className="mt-1 size-4 shrink-0 text-green dark:text-green" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 4.293 10.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="font-sans">{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>

        </div>
    );
};

interface PricingCard {
    title: string;
    subtitle?: string;
    price: string;
    per: string;
    features: string[];
    cta: string;
    recommended: boolean;
}

type BillingPeriod = 'monthly' | 'annual';

export default function PricingPage(): JSX.Element {
    const t = useTranslations("Pricing");
    const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');

    const getPriceForPeriod = (plan: 'free' | 'essentials' | 'team') => {
        const priceKey = billingPeriod === 'monthly' ? 'priceMonthly' : 'price';
        return t(`plans.${plan}.${priceKey}`);
    };

    const getPerForPeriod = (plan: 'free' | 'essentials' | 'team') => {
        const perKey = billingPeriod === 'monthly' ? 'perMonthly' : 'per';
        return t(`plans.${plan}.${perKey}`);
    };

    const cards: PricingCard[] = [
        {
            title: t('plans.free.title'),
            subtitle: t('plans.free.subtitle'),
            price: getPriceForPeriod('free'),
            per: getPerForPeriod('free'),
            features: [
                t('plans.free.features.5'),
                t('plans.free.features.0'),
                t('plans.free.features.1'),
                t('plans.free.features.2'),
                t('plans.free.features.3'),
                t('plans.free.features.4'),
                t('plans.free.features.6'),
            ],
            cta: t('plans.free.cta'),
            recommended: false,
        },
        {
            title: t('plans.essentials.title'),
            subtitle: t('plans.essentials.subtitle'),
            price: getPriceForPeriod('essentials'),
            per: getPerForPeriod('essentials'),
            features: [
                t('plans.essentials.features.0'),
                t('plans.essentials.features.1'),
                t('plans.essentials.features.2'),
                t('plans.essentials.features.3'),
                t('plans.essentials.features.4'),
                t('plans.essentials.features.5'),
                t('plans.essentials.features.6'),
                t('plans.essentials.features.7'),
                t('plans.essentials.features.8'),
            ],
            cta: t('plans.essentials.cta'),
            recommended: true,
        },
        {
            title: t('plans.team.title'),
            subtitle: t('plans.team.subtitle'),
            price: getPriceForPeriod('team'),
            per: getPerForPeriod('team'),
            features: [
                t('plans.team.features.0'),
                t('plans.team.features.1'),
                t('plans.team.features.2'),
                t('plans.team.features.3'),
                t('plans.team.features.4'),
            ],
            cta: t('plans.team.cta'),
            recommended: false,
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 px-6 py-16 dark:bg-gray-900">
            <div className="mx-auto max-w-6xl">
                <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="font-sans text-4xl font-extrabold leading-tight text-[#26364d] dark:text-white md:text-5xl">
                            {t('choosePlan')}
                        </h1>
                        <p className="mt-4 max-w-2xl font-sans text-gray-600 dark:text-gray-400">
                            {t('simple')}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setBillingPeriod('monthly')}
                            className={`rounded-full border px-4 py-2 font-sans text-sm transition-colors ${
                                billingPeriod === 'monthly'
                                    ? 'border-transparent bg-green text-white dark:bg-green dark:text-white'
                                    : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                        >
                            {t('monthly')}
                        </button>
                        <button
                            onClick={() => setBillingPeriod('annual')}
                            className={`rounded-full border px-4 py-2 font-sans text-sm transition-colors ${
                                billingPeriod === 'annual'
                                    ? 'border-transparent bg-green text-white dark:bg-green dark:text-white'
                                    : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                        >
                            {t('annual')}
                        </button>
                    </div>
                </header>

                <main>
                    <div className="my-1 grid grid-cols-1 gap-6 md:grid-cols-3">
                        {cards.map((card: PricingCard, idx: number) => (
                            <PriceCard key={idx} {...card} />
                        ))}
                    </div>
                </main>

                <footer className="mt-12 text-center font-sans text-sm text-gray-500 dark:text-gray-400">
                    {t('questions')} <a href="#" className="font-medium text-emerald-600 dark:text-emerald-400">{t('contactSales')}</a>
                </footer>
            </div>
        </div>
    );
}
