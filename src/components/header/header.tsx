'use client';

import { Logo } from '@/components/logo';
import { Link, usePathname } from '@/i18n/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { ROUTES } from '@/lib/consts';
import { useLocale, useTranslations } from 'next-intl';
import { Locale } from '@/i18n/config';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '../ui/button/button';
import { Hamburger } from '@/components/header/hamburger';
import { useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { MenuOverlay } from './menu-overlay';
import { AppPathnames } from '@/i18n/routing';
import { buildMapUrl } from '@/lib/map-url-builder';

const fadeInKeyframes = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.5s ease-out forwards;
}

@keyframes megaMenuFadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-megaMenuFadeIn {
  animation: megaMenuFadeIn 0.3s ease-out forwards;
}
`;

// Categories data - matches your existing translation keys
const BUSINESS_CATEGORIES = [
    'Grocery',
    'Transport',
    'Financial',
    'Renovation',
    'Law',
    'Beauty',
    'Health',
    'Mechanics',
    'Entertainment',
    'Education',
    'Government',
    'Others'
];

const MegaMenu = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const t = useTranslations('MapPage.Categories');
    const locale = useLocale() as Locale;

    if (!isOpen) return null;

    return (
        <div
            className="absolute top-full left-0 w-[600px] max-w-[90vw] bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border border-gray-100 dark:border-gray-700 z-50 animate-megaMenuFadeIn"
            role="menu"
            aria-label="Menu kategorii firm"
        >
            <div className="p-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-6">
                    {t('AllCategories')}
                </h3>

                <div className="grid grid-cols-3 gap-2 lg:gap-3">
                    {BUSINESS_CATEGORIES.map((categoryKey) => {
                        // Build slug-based URL for category
                        const categoryUrl = buildMapUrl({ category: categoryKey.toLowerCase() }, locale);
                        return (
                            <Link
                                key={categoryKey}
                                href={{
                                    pathname: categoryUrl.pathname as AppPathnames,
                                    query: categoryUrl.query
                                }}
                                className="block px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-green-600 dark:hover:text-green-400 transition-all duration-200 hover:translate-x-1"
                                role="menuitem"
                                onClick={onClose}
                            >
                                {t(categoryKey)}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const BusinessMenuItem = ({ pathname, title }: { pathname: string; title: string }) => {
    const [megaMenuOpen, setMegaMenuOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setMegaMenuOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setMegaMenuOpen(false);
        }, 300); // 300ms delay before closing
    };

    const closeMegaMenu = () => {
        setMegaMenuOpen(false);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Business menu should never be active since it's a dropdown, not a direct link
    const isBusinessActive = false;

    return (
        <li
            className="flex items-center relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <Button
                className="min-w-36 group"
                variant={isBusinessActive ? 'active' : 'outline'}
                aria-expanded={megaMenuOpen}
                aria-haspopup="true"
            >
                <span className="flex items-center gap-2">
                    {title}
                    <svg
                        className={`w-4 h-4 transition-transform duration-200 ${megaMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </Button>

            <MegaMenu isOpen={megaMenuOpen} onClose={closeMegaMenu} />
        </li>
    );
};

export const Header = () => {
    const [navbarOpen, setNavbarOpen] = useState(false);
    const pathname = usePathname();
    const headerRef = useRef<HTMLElement>(null);

    const locale = useLocale() as Locale;
    const t = useTranslations('NavBar');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
                setNavbarOpen(false);
            }
        };

        if (navbarOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Prevent body scroll when menu is open
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = '';
        };
    }, [navbarOpen]);

    // Filter out routes and add business menu logic
    const allLinks = Object.values(ROUTES)
        .filter(link => link.path !== '/blog') // Keep map link
        .map(route => ({
            href: route.path,
            title: t(route.name),
        }));

    // Split links to put Business in the middle
    const homeLinks = allLinks.filter(link => link.href === '/');
    const mapLinks = allLinks.filter(link => link.href === '/map');
    const otherLinks = allLinks.filter(link => link.href !== '/' && link.href !== '/map');

    const toggleNavbar = () => {
        setNavbarOpen(!navbarOpen);
    };

    const closeNavbar = () => {
        setNavbarOpen(false);
    };

    return (
        <>
            <style jsx global>
                {fadeInKeyframes}
            </style>

            {/* Skip Links */}
            <div className="sr-only focus-within:not-sr-only">
                <a
                    href="#main-content"
                    className="fixed left-2 top-2 rounded bg-blue-600 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-300 z-[9999]"
                >
                    Przejdź do głównej treści
                </a>
                <a
                    href="#mobile-navigation"
                    className="fixed left-40 top-2 rounded bg-blue-600 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-300 z-[9999]"
                >
                    Przejdź do nawigacji
                </a>
            </div>

            <header
                ref={headerRef}
                className="sticky top-0 left-0 right-0 z-50 flex h-20 items-center justify-between px-3 sm:px-9 md:mb-3 bg-[#F6F6F7] dark:bg-[#111827]"
                role="banner"
            >
                <Logo />
                <Hamburger
                    navbarOpen={navbarOpen}
                    toggleNavbar={toggleNavbar}
                    menuId="mobile-navigation"
                />
                <nav
                    className="hidden lg:block"
                    aria-label="Menu główne"
                    role="navigation"
                >
                    <ul className="flex items-center gap-x-8 rounded-full border-2 border-gray-200 bg-white px-1.5 py-1 text-sm dark:border-gray-700 dark:bg-[#111827]">
                        {/* Home link - first */}
                        {homeLinks.map(({ href, title }) => (
                            <li key={href} className="flex items-center">
                                <Button
                                    asChild
                                    className="min-w-36"
                                    variant={pathname === href ? 'active' : 'outline'}
                                >
                                    <Link
                                        href={href}
                                        prefetch={true}
                                        aria-current={pathname === href ? 'page' : undefined}
                                    >
                                        {title}
                                    </Link>
                                </Button>
                            </li>
                        ))}

                        {/* Business mega menu item - second */}
                        <BusinessMenuItem
                            pathname={pathname}
                            title={t('Business')}
                        />

                        {/* Map link - third */}
                        {mapLinks.map(({ href, title }) => {
                            const isMapActive = pathname === href || pathname.startsWith(href + '/');
                            return (
                                <li key={href} className="flex items-center">
                                    <Button
                                        asChild
                                        className="min-w-36"
                                        variant={isMapActive ? 'active' : 'outline'}
                                    >
                                        <Link
                                            href={href}
                                            prefetch={true}
                                            aria-current={isMapActive ? 'page' : undefined}
                                        >
                                            {title}
                                        </Link>
                                    </Button>
                                </li>
                            );
                        })}

                        {/* Other navigation items - after map */}
                        {otherLinks.map(({ href, title }) => (
                            <li key={href} className="flex items-center">
                                <Button
                                    asChild
                                    className="min-w-36"
                                    variant={pathname === href ? 'active' : 'outline'}
                                >
                                    <Link
                                        href={href}
                                        prefetch={true}
                                        aria-current={pathname === href ? 'page' : undefined}
                                    >
                                        {title}
                                    </Link>
                                </Button>
                            </li>
                        ))}

                        <li className="flex items-center">
                            <div aria-label="Przełącznik języka">
                                <LanguageSwitcher locale={locale} />
                            </div>
                        </li>

                        <li className="flex items-center">
                            <div aria-label="Przełącznik motywu">
                                <ThemeToggle />
                            </div>
                        </li>
                    </ul>
                </nav>

                <MenuOverlay isOpen={navbarOpen} onClose={closeNavbar} pathname={pathname} locale={locale} />
            </header>
        </>
    );
};
