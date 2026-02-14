import React from 'react';
import { getTranslations } from 'next-intl/server';
import { LoadingLogo } from '@/components/loading-logo';

export default async function LoadingPage() {
    const t = await getTranslations('Loading');
    return (
        <div
            className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={t("loading")}
        >
            <div className="flex flex-col items-center max-w-xs px-4">
                {/* Centered Logo Container */}
                <div className="mb-8 w-full flex justify-center" aria-hidden="true">
                    <LoadingLogo />
                </div>

                <div className="w-full">
                    <div
                        className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-green-500 dark:border-gray-700 dark:border-t-green-400"
                        aria-hidden="true"
                    ></div>

                    <div
                        className="mb-6 flex justify-center space-x-2"
                        aria-hidden="true"
                    >
                        {[0, 150, 300].map(delay => (
                            <div
                                key={delay}
                                className="h-2 w-2 animate-pulse rounded-full bg-green-500 dark:bg-green-400"
                                style={{ animationDelay: `${delay}ms` }}
                            ></div>
                        ))}
                    </div>
                </div>

                <div className="text-sm font-medium text-gray-600 dark:text-gray-300 text-center">
                    {t("loading")}
                </div>

                <div className="text-gray-400 dark:text-gray-500 text-xs mt-2 text-center">
                    {t("loadingDescription")}
                </div>
            </div>
        </div>
    );
};