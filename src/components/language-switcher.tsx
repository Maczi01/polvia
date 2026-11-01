'use client';

import Image from 'next/image';
import { Locale } from '@/i18n/config';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SelectScrollable } from '@/components/ui/select/select-scrollable';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useParams, useSearchParams } from 'next/navigation';
import { getCategoryFromSlug, getSlugFromCategory } from '@/lib/slug-mappings';
import { type AppPathnames, routing } from '@/i18n/routing';

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

type QueryObject = Record<string, string>;

type RouteParams = ReturnType<typeof useParams>;

/** Nazwy parametrow szablonu trasy: `/firma/[slug]` → `'slug'`. */
type RouteParamName<Pathname> = Pathname extends `${string}[${infer Name}]${infer Rest}`
    ? Name | RouteParamName<Rest>
    : never;

/** Trasy z `routing.pathnames`, ktore maja segmenty dynamiczne (np. `/firma/[slug]`). */
type DynamicPathname = Exclude<keyof typeof routing.pathnames, AppPathnames>;

type DynamicLocaleSwitchHref = {
    [Pathname in DynamicPathname]: {
        pathname: Pathname;
        params: Record<RouteParamName<Pathname>, string>;
        query: QueryObject;
    };
}[DynamicPathname];

type LocaleSwitchHref = DynamicLocaleSwitchHref | { pathname: AppPathnames; query: QueryObject };

const DYNAMIC_PATHNAMES: ReadonlySet<string> = new Set(
    Object.keys(routing.pathnames).filter(pathname => pathname.includes('[')),
);

const ROUTE_PARAM_PATTERN = /\[([^\]]+)\]/g;

function isDynamicPathname(pathname: string): pathname is DynamicPathname {
    return DYNAMIC_PATHNAMES.has(pathname);
}

/** Czy `useParams()` ma wszystkie parametry szablonu trasy jako pojedyncze wartosci. */
function hasRouteParams<Pathname extends DynamicPathname>(
    pathname: Pathname,
    params: RouteParams,
): params is RouteParams & Record<RouteParamName<Pathname>, string> {
    return [...pathname.matchAll(ROUTE_PARAM_PATTERN)].every(
        ([, name]) => typeof params[name] === 'string',
    );
}

/**
 * Cel `router.replace` przy zmianie jezyka. Dla trasy z parametrem `usePathname()` zwraca
 * szablon (`/firma/[slug]`), wiec dostaje ona `params` z `useParams()` (bez `locale`, ktore
 * idzie osobno) — bez nich next-intl rzuca „Insufficient params”. Dotyczy kazdej trasy
 * z `[param]` w `routing.pathnames`, nie tylko profilu. Brak parametru (nie powinien
 * wystapic na tej trasie) konczy sie strona glowna zamiast wyjatku.
 */
function buildLocaleSwitchHref(
    pathname: string,
    params: RouteParams,
    query: QueryObject,
    fromLocale: Locale,
    toLocale: Locale,
): LocaleSwitchHref {
    if (isDynamicPathname(pathname)) {
        if (!hasRouteParams(pathname, params)) return { pathname: '/', query };

        const { locale: _locale, ...routeParams } = params;
        return { pathname, params: routeParams, query };
    }

    // Sciezki mapy (`/map/<kategoria>`) nie sa kluczami `routing.pathnames` — next-intl
    // przepuszcza je bez zmian, wiec typ trzeba tu zawezic recznie.
    return {
        pathname: translateMapPathname(pathname, fromLocale, toLocale) as AppPathnames,
        query,
    };
}

export const LanguageSwitcher = ({ locale }: { locale: Locale }) => {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();
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

        // Navigate to new locale while preserving search parameters
        router.replace(
            buildLocaleSwitchHref(pathname, params, queryObject, selectedLocale, newLocale),
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
            ['en', 'pl', 'ru', 'uk'].includes(storedLocale)) {
            // Convert search params to object for the query parameter
            const queryObject: Record<string, string> = {};
            searchParams.forEach((value, key) => {
                queryObject[key] = value;
            });

            // Redirect to user's preferred language while preserving search parameters
            router.replace(
                buildLocaleSwitchHref(pathname, params, queryObject, locale, storedLocale),
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
                            <Image src="/icons/ua.svg" alt="Ukrainian flag" width={16} height={16} />
                            <span className="ml-2 text-gray-900 dark:text-gray-100">Українська</span>
                        </div>
                    ),
                    value: 'uk',
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
                            <Image src="/icons/ru.svg" alt="Russian flag" width={16} height={16} />
                            <span className="ml-2 text-gray-900 dark:text-gray-100">Русский</span>
                        </div>
                    ),
                    value: 'ru',
                },
            ]}
            placeholder="Select language"
            onValueChange={(value: string) => changeLocale(value as Locale)}
        />
    );
};