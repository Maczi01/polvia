'use client';

import Image from 'next/image';
import { Locale } from '@/i18n/config';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SelectScrollable } from '@/components/ui/select/select-scrollable';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { getCategoryFromSlug, getSlugFromCategory } from '@/lib/slug-mappings';
import { type AppPathnames } from '@/i18n/routing';

/**
 * Translates map route slugs when switching locale.
 * usePathname() returns /mapa/remonty for PL but /map/renovation for EN,
 * so we need to handle both prefixes.
 */
function translateMapPathname(pathname: string, fromLocale: Locale, toLocale: Locale): string {
    let slugPart: string | null = null;

    if (pathname.startsWith('/mapa/')) {
        slugPart = pathname.slice('/mapa/'.length);
    } else if (pathname.startsWith('/map/')) {
        slugPart = pathname.slice('/map/'.length);
    }

    if (slugPart === null) return pathname;

    const segments = slugPart.split('/');
    const translated = segments.map((segment) => {
        const category = getCategoryFromSlug(segment, fromLocale);
        if (category) {
            return getSlugFromCategory(category, toLocale) ?? segment;
        }
        // County slugs are the same across locales — keep as-is
        return segment;
    });

    return `/map/${translated.join('/')}`;
}

export const LanguageSwitcher = ({ locale }: { locale: Locale }) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
    const [isClient, setIsClient] = useState(false);

    const t = useTranslations('NavBar');

    useEffect(() => {
        setSelectedLocale(locale);
    }, [locale]);

    const changeLocale = (newLocale: Locale) => {
        if (newLocale === selectedLocale) return;

        // Save to localStorage
        if (isClient) {
            localStorage.setItem('preferred-locale', newLocale);
        }

        // Convert search params to object for the query parameter
        const queryObject: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            queryObject[key] = value;
        });

        // Translate map category slugs to the target locale
        const translatedPathname = translateMapPathname(pathname, selectedLocale, newLocale);

        // Navigate to new locale while preserving search parameters
        router.replace(
            { pathname: translatedPathname as AppPathnames, query: queryObject },
            { locale: newLocale }
        );
        setSelectedLocale(newLocale);
    };

    const ariaLabel = t('language');

    useEffect(() => {
        setIsClient(true);

        // Check if user has a stored preference different from URL
        const storedLocale = localStorage.getItem('preferred-locale') as Locale;

        if (storedLocale && storedLocale !== locale &&
            ['en', 'pl'].includes(storedLocale)) {
            // Convert search params to object for the query parameter
            const queryObject: Record<string, string> = {};
            searchParams.forEach((value, key) => {
                queryObject[key] = value;
            });

            // Translate map category slugs to the stored locale
            const translatedPathname = translateMapPathname(pathname, locale, storedLocale);

            // Redirect to user's preferred language while preserving search parameters
            router.replace(
                { pathname: translatedPathname as AppPathnames, query: queryObject },
                { locale: storedLocale }
            );
        }
    }, []);

    return (
        <SelectScrollable
            className="w-36 md:w-44"
            value={selectedLocale}
            showDefault={false}
            ariaLabel={ariaLabel}
            options={[
                {
                    label: (
                        <div className="flex items-center">
                            <Image src="/icons/gb.svg" alt="English flag" width={16} height={16} />
                            <span className="ml-2 text-gray-900 dark:text-gray-100">English</span>
                        </div>
                    ),
                    value: 'en',
                },
                {
                    label: (
                        <div className="flex items-center">
                            <Image src="/icons/pl.svg" alt="Polish flag" width={16} height={16} />
                            <span className="ml-2 text-gray-900 dark:text-gray-100">Polski</span>
                        </div>
                    ),
                    value: 'pl',
                },
            ]}
            placeholder="Select language"
            onValueChange={(value: string) => changeLocale(value as Locale)}
        />
    );
};