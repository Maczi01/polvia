'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function TrustSection() {
    const t = useTranslations('TrustSection');

    const trustItems = [
        { titleKey: 'item1Title', descKey: 'item1Desc', badgeKey: 'item1Badge' },
        { titleKey: 'item2Title', descKey: 'item2Desc', badgeKey: 'item2Badge' },
        { titleKey: 'item3Title', descKey: 'item3Desc', badgeKey: 'item3Badge' },
        { titleKey: 'item4Title', descKey: 'item4Desc', badgeKey: 'item4Badge' },
    ] as const;

    const featuredCompanies = [
        { nameKey: 'company1Name', categoryKey: 'company1Category', cityKey: 'company1City', metaKey: 'company1Meta' },
        { nameKey: 'company2Name', categoryKey: 'company2Category', cityKey: 'company2City', metaKey: 'company2Meta' },
        { nameKey: 'company3Name', categoryKey: 'company3Category', cityKey: 'company3City', metaKey: 'company3Meta' },
    ] as const;

    return (
        <section className="w-full bg-gradient-to-b from-sky-50 via-white to-white py-20 dark:from-gray-900 dark:via-gray-800 dark:to-gray-800">
            <div className="mx-auto max-w-6xl px-6">
                <div className="mx-auto max-w-3xl text-center">
                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-sm font-medium text-sky-700 dark:border-green-400/30 dark:bg-green-900/20 dark:text-green-400">
                        {t('badge')}
                    </span>
                    <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-gray-100">
                        {t('title')}
                    </h2>
                    <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg dark:text-gray-300">
                        {t('subtitle')}
                    </p>
                </div>

                <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {trustItems.map((item) => (
                        <div
                            key={item.titleKey}
                            className="rounded-3xl border border-sky-100 bg-white/90 p-6 shadow-[0_10px_30px_rgba(14,165,233,0.08)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_40px_rgba(14,165,233,0.14)] dark:border-gray-600 dark:bg-[#111827] dark:shadow-gray-900/20 dark:hover:border-green-500 dark:hover:shadow-gray-900/30"
                        >
                            <div className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-400/30">
                                {t(item.badgeKey)}
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-gray-100">
                                {t(item.titleKey)}
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-gray-300">
                                {t(item.descKey)}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-600 p-8 text-white shadow-[0_18px_50px_rgba(37,99,235,0.22)] dark:border-gray-600 dark:from-sky-800 dark:via-blue-800 dark:to-indigo-800 dark:shadow-gray-900/30">
                        <div className="max-w-2xl">
                            <p className="text-sm font-medium text-sky-100 dark:text-sky-200">
                                {t('forUsersAndBusiness')}
                            </p>
                            <h3 className="mt-3 text-2xl font-semibold md:text-3xl">
                                {t('verifiedTitle')}
                            </h3>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-sky-50/90 md:text-base dark:text-sky-100/80">
                                {t('verifiedDesc')}
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                                <div className="text-2xl font-semibold">{t('stat1Value')}</div>
                                <div className="mt-1 text-sm text-sky-100">{t('stat1Label')}</div>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                                <div className="text-2xl font-semibold">{t('stat2Value')}</div>
                                <div className="mt-1 text-sm text-sky-100">{t('stat2Label')}</div>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                                <div className="text-2xl font-semibold">{t('stat3Value')}</div>
                                <div className="mt-1 text-sm text-sky-100">{t('stat3Label')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_10px_30px_rgba(14,165,233,0.08)] dark:border-gray-600 dark:bg-[#111827] dark:shadow-gray-900/20">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-sky-700 dark:text-green-400">
                                    {t('featuredLabel')}
                                </p>
                                <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-gray-100">
                                    {t('featuredTitle')}
                                </h3>
                            </div>
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-green-900/20 dark:text-green-400">
                                {t('featuredBadge')}
                            </span>
                        </div>

                        <div className="mt-6 space-y-3">
                            {featuredCompanies.map((company) => (
                                <div
                                    key={company.nameKey}
                                    className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/50"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-base font-semibold text-slate-900 dark:text-gray-100">
                                                {t(company.nameKey)}
                                            </div>
                                            <div className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                                                {t(company.categoryKey)}
                                            </div>
                                        </div>
                                        <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-100 dark:bg-gray-800 dark:text-green-400 dark:ring-gray-600">
                                            {t(company.cityKey)}
                                        </div>
                                    </div>
                                    <div className="mt-3 text-xs font-medium uppercase tracking-wide text-sky-700/80 dark:text-green-400/80">
                                        {t(company.metaKey)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Link href="/map" prefetch>
                            <button className="mt-6 inline-flex rounded-2xl bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-700 dark:bg-green-600 dark:hover:bg-green-500">
                                {t('viewAll')}
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
