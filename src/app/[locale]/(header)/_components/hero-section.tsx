'use client';

import { useTranslations } from 'next-intl';
import { HeroSearch } from '@/app/[locale]/(header)/_components/hero-search';

export default function HeroSection() {
    const t = useTranslations('Main');

    return (
        <section
            className="flex min-h-[90vh] items-start py-6 md:items-center md:py-8 lg:py-8"
            aria-labelledby="hero-heading"
        >
            <div className="container mx-auto w-full px-4 md:px-8 lg:px-16 xl:px-24">
                <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-8">
                    {/* Content Column */}
                    <div className="flex flex-col space-y-4 md:space-y-6 md:pr-6">
                        <h1
                            id="hero-heading"
                            className="text-center text-4xl font-bold leading-tight text-[#26364d]
                            dark:text-gray-300 md:text-left md:text-4xl lg:text-5xl xl:text-6xl"
                        >
                            <div>
                                <span>{t('titleStart')}</span>{' '}
                                <span className="relative inline-block text-green dark:text-green-400">
                                    {t('titleHighlight')}
                                    <span
                                        className="absolute -bottom-2 left-0 -z-10 h-3 w-full rounded-full bg-green/20 dark:bg-green-400/20"
                                        aria-hidden="true"
                                    ></span>
                                </span>{' '}
                                <span>{t('titleEnd')}</span>
                            </div>
                            <div className="mt-2">
                                <span>{t('titleSecondLine')}</span>
                            </div>
                        </h1>

                        <div
                            className="max-w-prose text-base text-gray-700 dark:text-gray-300 md:text-lg lg:text-xl"
                            role="region"
                            aria-labelledby="hero-description"
                        >
                            <h2 id="hero-description" className="sr-only">
                            {t('ServiceDescription')}
                            </h2>
                            <p className="text-center md:text-left">{t('subtitle1')}</p>
                            <p className="text-center md:text-left">{t('subtitle2')}</p>
                        </div>

                        <HeroSearch />
                    </div>

                    {/* Image Column */}
                    <div
                        className="relative order-1 h-96 w-full sm:h-80 md:order-2 md:h-96 lg:h-[450px] xl:h-[550px]"
                        role="img"
                        aria-labelledby="hero-image-description"
                    >
                        <h3 id="hero-image-description" className="sr-only">
                            {t('MapDescription')}
                        </h3>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <object
                            type="image/svg+xml"
                            data="/logo/hero.svg"
                            aria-label={t('mapDesc')}
                            className="h-full w-full object-contain dark:brightness-90 dark:contrast-110"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}