'use client';
import Image from 'next/image';
import { Service } from '@/types';
import { Badge } from '@/components/ui/badge/badge';
import { useTranslations } from 'next-intl';
import { mapCategoryToBadgeColor } from '@/lib/consts';
import { Link } from '@/i18n/navigation';
import { AppPathnames } from '@/i18n/routing';

type ValidHref =
    | AppPathnames
    | {
    pathname: AppPathnames;
    query?: Record<string, any>;
};

const PopularServiceCard = ({
                                icon,
                                name,
                                category,
                                href,
                            }: {
    icon?: string;
    name: string;
    category: string;
    href: ValidHref;
}) => {
    const badgeColor = mapCategoryToBadgeColor(category);
    const baseClasses = [
        'flex',
        'flex-col',
        'items-center',
        'justify-center',
        'rounded-xl',
        'border-2',
        'border-gray-200',
        'dark:border-gray-600',
        'bg-white',
        'dark:bg-gray-800',
        'p-4',
        'sm:p-6',
        'shadow-lg',
        'transition-all',
        'duration-300',
        'hover:shadow-xl',
        'hover:scale-105',
        'hover:border-green-300',
        'dark:hover:border-green-500',
        'hover:-translate-y-2',
        'focus:outline-none',
        'focus:ring-4',
        'focus:ring-green-500/30',
        'focus:ring-offset-2',
        'group',
        'relative',
        'overflow-hidden',
        'w-full',
        'h-full',
        'aspect-square',
    ].join(' ');

    const t = useTranslations('Main.Categories');

    const content = (
        <>
            {/* Subtle background gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-blue-50/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-green-900/10 dark:to-blue-900/10" />

            <div className="relative z-10 mb-3 flex size-20 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 shadow-inner transition-shadow duration-300 group-hover:shadow-lg dark:from-gray-700 dark:to-gray-800 sm:mb-4 sm:size-28 sm:rounded-2xl">
                {icon ? (
                    <Image
                        src={icon}
                        alt={`${name} - ${t('serviceWrapper')} ${t(category)}`}
                        width={70}
                        height={70}
                        className="rounded-xl object-contain transition-transform duration-300 group-hover:scale-110 sm:size-[100px] sm:rounded-2xl"
                    />
                ) : (
                    <div
                        className="size-8 rounded-full bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500 sm:size-12"
                        aria-hidden="true"
                    />
                )}
            </div>

            <span className="relative z-10 mb-2 px-1 text-center text-sm font-bold leading-tight text-gray-900 transition-colors duration-300 group-hover:text-green-700 dark:text-gray-100 dark:group-hover:text-green-300 sm:mb-3 sm:text-lg">
                {name}
            </span>

            <Badge
                variant={badgeColor}
                className="relative z-10 shadow-sm transition-shadow duration-300 group-hover:shadow-md"
                label={t(`${category}`)}
            />
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className={baseClasses}
                aria-label={`${name}, ${t(`${category}`)}`}
            >
                {content}
            </Link>
        );
    }

    return <div className={baseClasses}>{content}</div>;
};

type PopularServicesGridClientProps = {
    services: Service[];
};

export function PopularServicesGridClient({ services }: PopularServicesGridClientProps) {
    const t = useTranslations('Main');

    const imageMap = (image: string) => {
        return image ? `/services/${image.trimEnd()}` : '/default.png';
    };

    // Ensure we only show top 5 services
    const topServices = services.slice(0, 5);

    return (
        <section
            className="w-full bg-gradient-to-b from-white to-gray-50 dark:from-[#111827] dark:to-gray-900"
            aria-labelledby="popular-companies-heading"
        >
            <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h2
                        id="popular-companies-heading"
                        className="text-left text-2xl font-bold text-gray-900 dark:text-gray-100"
                    >
                        {t('popularCompanies')}
                    </h2>
                </div>

                {/* Grid Layout - Responsive */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-6 xl:grid-cols-5">
                    {topServices.map((service, index) => (
                        <PopularServiceCard
                            key={service.id}
                            href={{
                                pathname: '/map' as AppPathnames,
                                query: { slug: service.slug },
                            }}
                            icon={imageMap(service.image!)}
                            name={service.name}
                            category={service.category}
                        />
                    ))}
                </div>

                {/* Optional: Add a "View All Services" link */}
                <div className="mt-12 text-center">
                    <Link
                        href="/map"
                        className="inline-flex items-center rounded-xl bg-green px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-green-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-green-500/30"
                    >
                        {t('Categories.viewAll')}
                        <svg
                            className="ml-2 size-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </Link>
                </div>
            </div>

            {/* Add CSS for fade-in animation */}
            <style jsx>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </section>
    );
}