import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { MapPin } from 'lucide-react';
import { CITY_SLUGS, getCityDisplayName } from '@/lib/slug-mappings';
import type { Locale } from '@/i18n/config';

export async function PopularCities() {
    const locale = (await getLocale()) as Locale;
    const t = await getTranslations({ locale, namespace: 'Main' });

    return (
        <section
            className="w-full bg-white dark:bg-[#111827]"
            aria-labelledby="popular-cities-heading"
        >
            <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h2
                        id="popular-cities-heading"
                        className="text-left text-2xl font-bold text-gray-900 dark:text-gray-100"
                    >
                        {t('popularCities')}
                    </h2>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                    {CITY_SLUGS.map(slug => {
                        const cityName = getCityDisplayName(slug, locale);
                        const href = locale === 'pl'
                            ? `/miasto/${slug}`
                            : `/${locale}/miasto/${slug}`;

                        return (
                            <Link
                                key={slug}
                                href={href}
                                className="group flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-green-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-500"
                            >
                                <div className="flex size-12 items-center justify-center rounded-full bg-green-50 text-green-600 transition-colors group-hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:group-hover:bg-green-900/30">
                                    <MapPin className="size-6" />
                                </div>
                                <span className="text-center text-sm font-semibold text-gray-900 transition-colors group-hover:text-green-700 dark:text-gray-100 dark:group-hover:text-green-300 sm:text-base">
                                    {cityName}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
