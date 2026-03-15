import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { serviceName } from '@/lib/consts';

export const HowItWorks = async () => {
    const t = await getTranslations('HowItWorks');

    return (
        <section
            className="pointer-events: none flex min-h-screen items-center py-6 md:py-8 lg:py-8"
            aria-labelledby="how-it-works-heading"
        >
            <div className="container mx-auto w-full px-4 md:px-8 lg:px-16 xl:px-24">
                <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-8">

                    {/* Left Column - Phone Mockup */}
                    <div
                        className="relative order-2 md:order-1"
                        role="img"
                        aria-labelledby="demo-description"
                    >
                        <h3 id="demo-description" className="sr-only">
                            {t('demoDescription')}
                        </h3>

                        <Link href="/map" prefetch className="block">
                            <div className="phone-mockup relative mx-auto max-w-sm cursor-pointer transition-transform duration-300 hover:scale-105">
                            {/* Step indicator */}
                            <div
                                className="step-indicator absolute right-5 top-1 z-10 flex size-12 animate-pulse items-center justify-center rounded-full bg-green text-lg font-bold text-white shadow-lg md:-right-4 md:-top-4"
                                aria-label={t('firstStep')}
                                role="img"
                            >
                                <span aria-hidden="true">1</span>
                            </div>

                            <div
                                className="phone-screen min-h-[32rem] rounded-3xl border border-gray-100 bg-white p-4 shadow-2xl"
                                role="region"
                                aria-label={t('interfacePreview')}
                            >
                                {/* Header */}
                                <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-green text-sm font-bold text-white">
                                        <Image
                                            src="/logo/only.svg"
                                            alt={t('logo')}
                                            width={72}
                                            height={72}
                                            className="hidden p-1 dark:block dark:brightness-0 dark:invert"
                                        />
                                        <Image
                                            src="/logo/only-dark.svg"
                                            alt={t('logo')}
                                            width={72}
                                            height={72}
                                            className=" block dark:hidden dark:brightness-0 dark:invert"
                                        />
                                    </div>
                                    <span className="text-lg font-semibold text-[#26364d]">
                                        {serviceName}
                                    </span>
                                </div>

                                {/* Search Bar */}
                                <div className="relative mb-4">
                                    <label htmlFor="demo-search" className="sr-only">
                                        {t('exampleSearch')}
                                    </label>
                                    <input
                                        id="demo-search"
                                        type="text"
                                        placeholder={t('search')}
                                        value={t("polishShopsAndServices")}
                                        readOnly
                                        tabIndex={-1}
                                        aria-describedby="demo-search-description"
                                        className="w-full cursor-default rounded-xl border-2 border-green bg-gray-50 p-3 font-medium text-gray-700"
                                    />
                                    <div id="demo-search-description" className="sr-only">
                                        {t("exampleSearchMechanic")}
                                    </div>
                                    <div
                                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-auto text-gray-400"
                                        aria-hidden="true"
                                    >
                                        🔍
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div
                                    className="mb-4 flex rounded-xl bg-gray-100 p-1"
                                    role="tablist"
                                    aria-label={t('results')}
                                >
                                    <button
                                        className="flex-1 cursor-auto rounded-lg bg-green px-4 py-2 text-sm font-medium text-white"
                                        role="tab"
                                        aria-selected="true"
                                        aria-controls="demo-list-panel"
                                        id="demo-list-tab"
                                        tabIndex={-1}
                                    >
                                        {t('list')}
                                    </button>
                                    <button
                                        className="flex-1 cursor-auto px-4 py-2 text-sm font-medium text-gray-600"
                                        role="tab"
                                        aria-selected="false"
                                        aria-controls="demo-map-panel"
                                        id="demo-map-tab"
                                        tabIndex={-1}
                                    >
                                        {t('map')}
                                    </button>
                                    <button
                                        className="flex-1 cursor-auto rounded-lg bg-[#26364d] px-4 py-2 text-sm font-medium text-white"
                                        role="tab"
                                        aria-selected="false"
                                        aria-controls="demo-filters-panel"
                                        id="demo-filters-tab"
                                        tabIndex={-1}
                                    >
                                        {t('filters')}
                                    </button>
                                </div>

                                {/* Business Cards */}
                                <div
                                    className="space-y-3"
                                    role="tabpanel"
                                    id="demo-list-panel"
                                    aria-labelledby="demo-list-tab"
                                    aria-label={t('listOfFoundCompanies')}
                                >
                                    {/* Card 1 */}
                                    <div
                                        className="business-card rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                        role="article"
                                        aria-labelledby="business-1-name"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-1 items-start gap-3">
                                                <div
                                                    className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-xs font-bold text-white"
                                                    aria-hidden="true"
                                                >
                                                    LC
                                                </div>
                                                <div className="flex-1">
                                                    <h4
                                                        id="business-1-name"
                                                        className="mb-1 text-sm font-semibold text-[#26364d]"
                                                    >
                                                        Lviv Croissants
                                                    </h4>
                                                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                                                        <span aria-label={t("location")}>📍</span>
                                                        <span>Kraków</span>
                                                    </div>
                                                    <span
                                                        className="inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
                                                        aria-label={t("category")}
                                                    >
                                                        {t("gastronomy")}
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                                className="flex size-8 cursor-auto items-center justify-center rounded-full bg-green bg-opacity-10"
                                                aria-label={t("goToDetails")}
                                                role="button"
                                                tabIndex={-1}
                                            >
                                                <span
                                                    className="text-sm text-green transition-transform duration-300 hover:translate-x-1"
                                                    aria-hidden="true"
                                                >
                                                    →
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 2 */}
                                    <div
                                        className="business-card rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                        role="article"
                                        aria-labelledby="business-2-name"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-1 items-start gap-3">
                                                <div
                                                    className="flex size-10 items-center justify-center rounded-xl bg-red-500 text-xs font-bold text-white"
                                                    aria-hidden="true"
                                                >
                                                    NP
                                                </div>
                                                <div className="flex-1">
                                                    <h4
                                                        id="business-2-name"
                                                        className="mb-1 text-sm font-semibold text-[#26364d]"
                                                    >
                                                        Nova Post
                                                    </h4>
                                                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                                                        <span aria-label={t("location")}>📍</span>
                                                        <span>Poznań</span>
                                                    </div>
                                                    <div className="flex gap-1" aria-label={t("category")}>
                                                        <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                                            {t("transport")}
                                                        </span>
                                                        <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                                            {t("logistics")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div
                                                className="flex size-8 cursor-auto items-center justify-center rounded-full bg-green bg-opacity-10"
                                                aria-label={t("goToDetails")}
                                                role="button"
                                                tabIndex={-1}
                                            >
                                                <span
                                                    className="text-sm text-green transition-transform duration-300 hover:translate-x-1"
                                                    aria-hidden="true"
                                                >
                                                    →
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3 */}
                                    <div
                                        className="business-card rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                        role="article"
                                        aria-labelledby="business-3-name"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-1 items-start gap-3">
                                                <div
                                                    className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-yellow-400 text-xs font-bold text-white"
                                                    aria-hidden="true"
                                                >
                                                    U
                                                </div>
                                                <div className="flex-1">
                                                    <h4
                                                        id="business-3-name"
                                                        className="mb-1 text-sm font-semibold text-[#26364d]"
                                                    >
                                                        Ukrainoczka
                                                    </h4>
                                                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                                                        <span aria-label={t("location")}>📍</span>
                                                        <span>Wrocław</span>
                                                    </div>
                                                    <span
                                                        className="inline-block rounded-full bg-pink-100 px-2 py-1 text-xs font-medium text-pink-700"
                                                        aria-label={t("category")}
                                                    >
                                                        {t("grocery")}
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                                className="flex size-8 cursor-auto items-center justify-center rounded-full bg-green bg-opacity-10"
                                                aria-label={t("goToDetails")}
                                                role="button"
                                                tabIndex={-1}
                                            >
                                                <span
                                                    className="text-sm text-green transition-transform duration-300 hover:translate-x-1"
                                                    aria-hidden="true"
                                                >
                                                    →
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </Link>
                    </div>

                    {/* Right Column - Content */}
                    <div className="order-1 flex flex-col space-y-4 md:order-2 md:space-y-6 md:pl-6">
                        <h2
                            id="how-it-works-heading"
                            className="text-center text-4xl font-bold leading-tight text-[#26364d] dark:text-gray-300 md:text-left md:text-5xl lg:text-4xl xl:text-5xl"
                        >
                            <span>{t('how')}</span>{' '}
                            <span className="relative inline-block text-green dark:text-green-400">
                                {t('works')}
                                <span
                                    className="absolute -bottom-2 left-0 -z-10 h-3 w-full rounded-full bg-green/20 dark:bg-green-400/20"
                                    aria-hidden="true"
                                ></span>
                            </span>{' '}
                            <span>{t('works1')}</span>{' '}
                        </h2>

                        <div
                            className="max-w-prose text-base text-gray-700 dark:text-gray-300 md:text-lg lg:text-xl"
                            role="region"
                            aria-labelledby="how-it-works-description"
                        >
                            <h3 id="how-it-works-description" className="sr-only">
                                {t('HowServiceWorksDescription')}
                            </h3>
                            <p className="text-center md:text-left">{t('description')}</p>
                        </div>

                        {/* Steps */}
                        <ol
                            className="space-y-6 pt-4 md:space-y-8"
                            aria-label={t("steps")}
                        >
                            {/* Step 1 */}
                            <li className="flex items-start gap-4 md:gap-6">
                                <div
                                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green text-lg font-bold text-white shadow-lg md:size-14 md:text-xl"
                                    aria-label="Krok pierwszy"
                                    role="img"
                                >
                                    <span aria-hidden="true">1</span>
                                </div>
                                <div className="pt-1">
                                    <h3 className="mb-2 text-xl font-semibold text-[#26364d] dark:text-gray-300 md:text-2xl">
                                        {t('find')}
                                    </h3>
                                    <p className="leading-relaxed text-gray-700 dark:text-gray-300 md:text-lg">
                                        {t('findDescription')}
                                    </p>
                                </div>
                            </li>

                            {/* Step 2 */}
                            <li className="flex items-start gap-4 md:gap-6">
                                <div
                                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green text-lg font-bold text-white shadow-lg md:size-14 md:text-xl"
                                    aria-label={t('secondStep')}
                                    role="img"
                                >
                                    <span aria-hidden="true">2</span>
                                </div>
                                <div className="pt-1">
                                    <h3 className="mb-2 text-xl font-semibold text-[#26364d] dark:text-gray-300 md:text-2xl">
                                        {t('compare')}
                                    </h3>
                                    <p className="leading-relaxed text-gray-700 dark:text-gray-300 md:text-lg">
                                        {t('compareDescription')}
                                    </p>
                                </div>
                            </li>

                            {/* Step 3 */}
                            <li className="flex items-start gap-4 md:gap-6">
                                <div
                                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green text-lg font-bold text-white shadow-lg md:size-14 md:text-xl"
                                    aria-label={t('thirdStep')}
                                    role="img"
                                >
                                    <span aria-hidden="true">3</span>
                                </div>
                                <div className="pt-1">
                                    <h3 className="mb-2 text-xl font-semibold text-[#26364d] dark:text-gray-300 md:text-2xl">
                                        {t('contact')}
                                    </h3>
                                    <p className="leading-relaxed text-gray-700 dark:text-gray-300 md:text-lg">
                                        {t('contactDescription')}
                                    </p>
                                </div>
                            </li>
                        </ol>

                        {/* CTA Button */}
                        <div className="pt-6">
                            <Link href="/map" prefetch>
                                <button
                                    className="mx-auto flex items-center gap-3 rounded-xl bg-green px-8 py-4 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-green-600 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-green-300 focus:ring-offset-2 md:mx-0"
                                    aria-describedby="cta-button-description"
                                >
                                    <span className="text-lg">{t('start')}</span>
                                    <span
                                        className="text-xl transition-transform duration-300 group-hover:translate-x-1"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </button>
                            </Link>
                            <div id="cta-button-description" className="sr-only">
                                {t('goToMapDescription')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
