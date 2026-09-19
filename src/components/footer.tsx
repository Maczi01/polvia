import React from 'react';
import { Link } from '@/i18n/navigation';
import { FooterNewsletter } from '@/app/[locale]/(header)/_components/footer-newsletter';
import { getTranslations } from 'next-intl/server';
import { Logo } from './logo';
import { serviceName } from '@/lib/consts';

export const Footer = async () => {
    const t = await getTranslations('FooterNewsletter');

    return (
        <footer
            className="bg-[#F1FAF4] py-10 dark:bg-gray-800"
            role="contentinfo"
            aria-labelledby="footer-heading"
        >
            <div className="container mx-auto px-4 md:px-8 lg:px-16 xl:px-32">
                {/* Hidden heading for screen readers */}
                <h2 id="footer-heading" className="sr-only">
                    Stopka strony z nawigacją, newsletterem i informacjami prawnymi
                </h2>

                {/* Main footer content */}
                <div className="flex flex-col space-y-6 border-b border-gray-200 pb-8 dark:border-gray-600 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">

                    {/* Logo section */}
                    <div className="flex items-center lg:shrink-0">
                        <div aria-label={`Logo firmy ${serviceName}`}>
                            <Logo />
                        </div>
                    </div>

                    {/* Navigation section */}
                    <nav
                        className="flex flex-col items-start space-y-3 sm:flex-row sm:items-center sm:space-x-6 sm:space-y-0 lg:flex-1 lg:justify-center lg:space-x-8"
                        aria-label="Menu stopki"
                        role="navigation"
                    >
                        <Link
                            href="/"
                            className="whitespace-nowrap rounded-md px-0 py-1 text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-300 dark:hover:text-gray-100 md:px-2"
                        >
                            {t('home')}
                        </Link>
                        <Link
                            href="/map"
                            className="whitespace-nowrap rounded-md px-0 py-1 text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-300 dark:hover:text-gray-100 md:px-2"
                        >
                            {t('map')}
                        </Link>
                        <Link
                            href="/contact"
                            className="whitespace-nowrap rounded-md px-0 py-1 text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-300 dark:hover:text-gray-100 md:px-2"
                        >
                            {t('contact')}
                        </Link>
                        <Link
                            href="/blog"
                            className="whitespace-nowrap rounded-md px-0 py-1 text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-300 dark:hover:text-gray-100 md:px-2"
                        >
                            {t('blog')}
                        </Link>
                    </nav>

                    {/* Newsletter section */}
                    <div
                        className="w-full sm:w-auto lg:max-w-sm lg:shrink-0"
                        role="region"
                        aria-labelledby="newsletter-heading"
                    >
                        <div className="flex flex-col space-y-3 sm:space-y-0">
                            <h3
                                id="newsletter-heading"
                                className="whitespace-nowrap font-medium text-gray-600 dark:text-gray-300 lg:text-base"
                            >
                                {t('subscribe')}
                            </h3>
                            <div className="w-full">
                                <FooterNewsletter />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom footer section */}
                <div className="flex flex-col items-center justify-between space-y-4 pt-6 sm:space-y-0">

                    {/* Copyright */}
                    <div>
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 sm:text-left">
                            {t('allRights')}
                        </p>
                    </div>

                    {/* Social Media Links */}
                    <div className="flex items-center space-x-4" aria-label="Media społecznościowe">
                        <a
                            href="https://www.facebook.com/profile.php?id=61594275489004"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1 text-gray-600 transition-colors hover:text-[#1877F2] focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-400 dark:hover:text-[#1877F2]"
                            aria-label="Facebook"
                        >
                            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                            </svg>
                        </a>
                        <a
                            href="https://t.me/polvia01"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-1 text-gray-600 transition-colors hover:text-[#229ED9] focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-400 dark:hover:text-[#229ED9]"
                            aria-label="Telegram"
                        >
                            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212-.07-.062-.174-.041-.249-.024-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                            </svg>
                        </a>
                    </div>

                    {/* Legal links */}
                    <nav
                        className="flex space-x-4 sm:space-x-6"
                        aria-label="Linki prawne"
                        role="navigation"
                    >
                        <Link
                            href="/terms"
                            className="whitespace-nowrap rounded-md p-1 text-sm text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            {t('terms')}
                        </Link>
                        <Link
                            href="/cookies"
                            className="whitespace-nowrap rounded-md p-1 text-sm text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            {t('cookies')}
                        </Link>
                    </nav>
                </div>

                {/* Additional screen reader information */}
                <div className="sr-only">
                    <h3>Informacje o stopce</h3>
                    <p>
                        Stopka zawiera główną nawigację po stronie, formularz zapisu do newslettera,
                        informacje o prawach autorskich oraz linki do dokumentów prawnych jak
                        regulamin, polityka prywatności i polityka cookies.
                    </p>
                </div>
            </div>
        </footer>
    );
};