'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { cn } from '@/lib/utilities';
import { CookieModal } from './cookie-modal';

/** Baner nie wchodzi od razu — daje uzytkownikowi chwile na zobaczenie strony. */
const SHOW_DELAY_MS = 3000;

/** Klasa animacji musi trafic na element JUZ zamontowany, inaczej nie ma przejscia. */
const ANIMATION_DELAY_MS = 100;

const CONSENT_COOKIE = 'cookieConsent';
const COOKIE_OPTIONS = { expires: 365, sameSite: 'strict' } as const;

export const CookieConsentBanner = () => {
    const t = useTranslations('Cookies');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [cookieConsented, setCookieConsented] = useState<boolean>(false);
    const [shouldShowBanner, setShouldShowBanner] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        const consent = Cookies.get(CONSENT_COOKIE);

        if (consent === 'accepted' || consent === 'declined') {
            setCookieConsented(true);
            return;
        }

        // Oba timery musza byc sprzatniete. Wewnetrzny powstaje dopiero w callbacku
        // zewnetrznego, wiec bez tej zmiennej wymykal sie cleanupowi i po odmontowaniu
        // banera strzelal `setState` w nieistniejacy komponent.
        let animationTimer: ReturnType<typeof setTimeout> | undefined;

        const showTimer = setTimeout(() => {
            setShouldShowBanner(true);
            animationTimer = setTimeout(() => setAnimateIn(true), ANIMATION_DELAY_MS);
        }, SHOW_DELAY_MS);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(animationTimer);
        };
    }, []);

    const handleAccept = () => {
        Cookies.set(CONSENT_COOKIE, 'accepted', COOKIE_OPTIONS);
        setCookieConsented(true);
    };

    const handleDecline = () => {
        Cookies.set(CONSENT_COOKIE, 'declined', COOKIE_OPTIONS);
        setCookieConsented(true);
    };

    return (
        <>
            {!cookieConsented && shouldShowBanner && (
                <div
                    className={cn(
                        'fixed bottom-0 left-0 right-0 z-50 p-3 transition-all duration-700 ease-out',
                        'md:bottom-5 md:left-auto md:right-5 md:w-full md:max-w-md md:p-0',
                        animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
                    )}
                >
                    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 text-white shadow-2xl">
                        <p className="text-sm leading-relaxed text-gray-200">
                            {t('text')}{' '}
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="rounded text-blue-400 underline underline-offset-2 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                                {t('more')}
                            </button>
                        </p>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={handleDecline}
                                className="rounded-full border border-gray-600 px-5 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                            >
                                {t('decline')}
                            </button>
                            <button
                                type="button"
                                onClick={handleAccept}
                                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                                {t('acceptAll')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <CookieModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </>
    );
};
