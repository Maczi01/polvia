'use client';

import { Locale } from '@/i18n/config';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useRef } from 'react';
import { ROUTES } from '@/lib/consts';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button/button';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';

type MenuOverlayProps = {
    isOpen: boolean;
    onClose: () => void;
    pathname: string;
    locale: Locale;
};

export const MenuOverlay = ({ isOpen, onClose, pathname, locale }: MenuOverlayProps) => {
    const t = useTranslations('NavBar');
    const searchParams = useSearchParams();
    const menuRef = useRef<HTMLElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const view = searchParams.get('view') || '';

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }

            // Trap focus within menu
            if (event.key === 'Tab') {
                const menu = menuRef.current;
                if (!menu) return;

                const focusableElements = menu.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0] as HTMLElement;
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                const lastElement = focusableElements.at(-1) as HTMLElement;

                if (event.shiftKey) {
                    if (document.activeElement === firstElement) {
                        event.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus management
    useEffect(() => {
        if (isOpen && menuRef.current) {
            // Focus first focusable element when menu opens
            const firstFocusable = menuRef.current.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ) as HTMLElement;
            firstFocusable?.focus();
        }
    }, [isOpen]);

    const handleLinkClick = () => {
        onClose();
    };

    const handleOverlayClick = (event: React.MouseEvent) => {
        if (event.target === overlayRef.current) {
            onClose();
        }
    };

    const transformedLinks = Object.values(ROUTES)
        .filter(link => link.path !== '/blog')
        .map(route => ({
            href: route.path,
            title: t(route.name),
        }));

    const isMapPage = pathname === '/map' || pathname.includes('/mapa');
    const isListView = view === 'list';
    const isMapView = view === 'map' || (view === '' && isMapPage);

    return (
        <>
            {/* Backdrop */}
            <div
                ref={overlayRef}
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ease-in-out ${
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={handleOverlayClick}
                aria-hidden="true"
            />

            {/* Menu - Made taller to fill more space */}
            <nav
                ref={menuRef}
                id="mobile-navigation"
                className={`fixed right-0 top-0 flex h-full w-2/3 flex-col
                gap-y-4 overflow-y-auto rounded-l-xl border-l-4 border-[#C52289] bg-white py-6 transition-transform duration-200 ease-in-out dark:bg-zinc-900 lg:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                aria-hidden={!isOpen}
                aria-label="Menu główne"
                role="navigation"
            >
                {/* Close Button */}
                <div className="flex justify-end px-4 pb-2">
                    <button
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C52289] focus:ring-offset-2 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        aria-label="Zamknij menu"
                    >
                        <svg
                            className="size-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <ul className="flex flex-col items-center gap-y-4">
                    {/* Theme Toggle Section */}
                    <li className="mb-4 w-full px-4">
                        <div className="flex items-center justify-between py-3">
                            <span
                                className="text-sm font-medium text-gray-700 dark:text-zinc-300"
                                id="theme-label"
                            >
                                {t('theme') || 'Motyw'}
                            </span>
                            <div aria-labelledby="theme-label">
                                <ThemeToggle />
                            </div>
                        </div>
                        <div className="mt-3 h-px bg-gray-200 dark:bg-zinc-700" aria-hidden="true" />
                    </li>

                    {/* Home link */}
                    {transformedLinks
                        .filter(link => link.href !== '/map')
                        .slice(0, 1)
                        .map(link => (
                            <li key={link.href}>
                                <Button
                                    asChild
                                    className="h-12 min-w-36"
                                    variant={pathname === link.href ? 'active' : 'outline'}
                                    onClick={handleLinkClick}
                                >
                                    <Link
                                        href={link.href}
                                        prefetch={true}
                                        aria-current={pathname === link.href ? 'page' : undefined}
                                    >
                                        {link.title}
                                    </Link>
                                </Button>
                            </li>
                        ))}

                    {/* Map navigation */}
                    <li>
                        <Button
                            asChild
                            className="h-12 min-w-36"
                            variant={isListView ? 'active' : 'outline'}
                            onClick={handleLinkClick}
                        >
                            <Link
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-expect-error
                                href={`/map?view=list`}
                                prefetch={true}
                                aria-current={isListView ? 'page' : undefined}
                            >
                                {t('list')}
                            </Link>
                        </Button>
                    </li>

                    <li>
                        <Button
                            asChild
                            className="h-12 min-w-36"
                            variant={isMapView ? 'active' : 'outline'}
                            onClick={handleLinkClick}
                        >
                            <Link
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-expect-error
                                href={`/map?view=map`}
                                prefetch={true}
                                aria-current={isMapView ? 'page' : undefined}
                            >
                                {t('map')}
                            </Link>
                        </Button>
                    </li>

                    {/* Other links */}
                    {transformedLinks
                        .filter(link => link.href !== '/map')
                        .slice(1)
                        .map(link => (
                            <li key={link.href}>
                                <Button
                                    asChild
                                    className="h-12 min-w-36"
                                    variant={pathname === link.href ? 'active' : 'outline'}
                                    onClick={handleLinkClick}
                                >
                                    <Link
                                        href={link.href}
                                        prefetch={true}
                                        aria-current={pathname === link.href ? 'page' : undefined}
                                    >
                                        {link.title}
                                    </Link>
                                </Button>
                            </li>
                        ))}

                    <li className="mt-6">
                        <LanguageSwitcher locale={locale} />
                    </li>
                </ul>
            </nav>
        </>
    );
};