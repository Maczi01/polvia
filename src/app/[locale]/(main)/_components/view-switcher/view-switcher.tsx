'use client';

import { useTranslations } from 'next-intl';
import { useViewState } from '@/hooks/use-view-state';

export const ViewSwitcher = () => {
    const t = useTranslations('MapPage');
    const { animationView, handleViewChange } = useViewState();

    return (
        <div className="relative my-2 flex w-1/2 items-center gap-x-0 rounded-full border border-gray-200 bg-gray-100 p-1 text-sm shadow-inner dark:border-gray-600 dark:bg-gray-800 dark:shadow-gray-900/50">
            <div
                className={`absolute h-[90%] w-1/2 rounded-full bg-green shadow-md transition-all duration-500 ease-in-out dark:bg-green-600 dark:shadow-gray-900/30${
                    animationView === 'list' ? ' translate-x-0' : ' translate-x-full'
                }`}
                style={{ top: '5%' }}
            ></div>

            <button
                onClick={() => handleViewChange('list')}
                className={`relative z-10 w-1/2 rounded-full px-6 py-2 transition-all duration-300 ${
                    animationView === 'list' ? 'text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
                {t('showList')}
            </button>
            <button
                onClick={() => handleViewChange('map')}
                className={`relative z-10 w-1/2 rounded-full px-6 py-2 transition-all duration-300 ${
                    animationView === 'map' ? 'text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
                {t('showMap')}
            </button>
        </div>
    );
};