import React from 'react';
import { Loader2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';


const ServiceCardSkeleton = () => {
    return (
        <div className="duration-1500 flex animate-pulse flex-col rounded-lg md:p-0 p-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm transition-all ease-in-out md:h-[124px]">
            {/* Mobile Layout */}
            <div className="md:hidden h-full">
                <div className="flex items-start pb-8 px-3 pt-3 h-24">
                    {/* Logo/Image Skeleton */}
                    <div className="mr-3 shrink-0 pt-1">
                        <div className="size-12 overflow-hidden rounded-full border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"></div>
                    </div>

                    {/* Name and Location Skeleton */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
                        <div className="mt-2 flex text-sm">
                            <div className="mr-1 mt-1 size-4 shrink-0 rounded bg-gray-200 dark:bg-gray-700"></div>
                            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                    </div>
                </div>

                {/* Tags and Arrow Button Skeleton */}
                <div className="flex items-end justify-between px-3 pb-3 mt-auto">
                    <div className="flex max-w-[80%] flex-wrap gap-1.5">
                        <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
                        <div className="h-6 w-12 rounded bg-gray-200 dark:bg-gray-700"></div>
                    </div>

                    <div className="ml-2 size-12 shrink-0 rounded-full bg-green-100 dark:bg-green-900/30"></div>
                </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:block h-full">
                <div className="flex shrink-0 flex-row justify-between h-full">
                    <div className="flex flex-row items-center gap-x-3 p-4">
                        <div className="shrink-0">
                            <div className="size-[68px] rounded-full border-2 border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"></div>
                        </div>

                        <div className="min-w-0 flex-1 flex-col">
                            <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700"></div>
                            <div className="mt-2 flex flex-row items-center">
                                <div className="mr-2 size-[22px] rounded bg-gray-200 dark:bg-gray-700"></div>
                                <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-row items-center gap-x-6 p-4">
                        <div className="flex gap-x-2">
                            <div className="h-6 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
                            <div className="h-6 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <div className="h-10 w-36 shrink-0 rounded bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                </div>
            </div>

            {/* Expandable Content Placeholder - Hidden by default */}
            <div className="h-0 overflow-hidden opacity-0 transition-all duration-500 ease-in-out">
            </div>
        </div>
    );
};

const MapSkeleton = async () => {
    const t = await getTranslations('NavBar');
    return (
        <div className="relative h-full rounded-md bg-gray-100 dark:bg-gray-800">
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center text-center">
                    <Loader2 className="mb-4 size-10 animate-spin text-green-500 dark:text-green-400" />
                    <div className="text-gray-500 dark:text-gray-400">
                        {t('loading')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ServicesLoadingSkeleton = ({ searchParams }: { searchParams?: { view?: string } }) => {
    const isListView = searchParams?.view === 'list';

    // Default is map view - only show list skeleton when explicitly in list view
    if (isListView) {
        return (
            <main className="relative h-full px-2">
                <div className="flex size-full gap-0 overflow-y-auto md:gap-x-2">
                    <div className="w-full md:w-7/12">
                        <div className="scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 flex size-full flex-col gap-y-2 overflow-y-auto bg-[#F6F6F7] dark:bg-gray-900 pr-2 md:gap-y-4">
                            {Array(10)
                                .fill(0)
                                .map((_, i) => (
                                    <ServiceCardSkeleton key={i} />
                                ))}
                        </div>
                    </div>
                    <div className="hidden md:block md:w-5/12">
                        <div className="relative h-full">
                            <MapSkeleton />
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // Default map view - show map skeleton on mobile, both on desktop
    return (
        <main className="relative h-full px-2">
            <div className="flex size-full">
                {/* Mobile: Show only map skeleton by default */}
                <div className="w-full md:hidden">
                    <MapSkeleton />
                </div>

                {/* Desktop: Show both list and map */}
                <div className="hidden md:flex md:w-full md:gap-x-2">
                    <div className="w-7/12">
                        <div className="scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800 flex size-full flex-col gap-y-4 overflow-y-auto bg-[#F6F6F7] dark:bg-gray-900 pr-2">
                            {Array(10)
                                .fill(0)
                                .map((_, i) => (
                                    <ServiceCardSkeleton key={i} />
                                ))}
                        </div>
                    </div>
                    <div className="w-5/12">
                        <div className="relative h-full">
                            <MapSkeleton />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};