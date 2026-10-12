'use client';

import { MessageCircle, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX, ReactNode } from 'react';

import type { BusinessPreview } from '@/lib/add-business/types';
import { cn } from '@/lib/utilities';

/**
 * Social media i komunikatory na podgladzie karty — kolejnosc, kolory i ikony skopiowane
 * z `service-card.tsx` (ikony sa tam lokalne, a `service-card` nie jest w zakresie tej
 * zmiany). Karta katalogu pokazuje ikony Facebook, Instagram, TikTok, LinkedIn, X oraz
 * przyciski WhatsApp (numer, a bez niego link) i Telegram; YouTube, Viber i Tripadvisor
 * sa w danych, ale karta ich nie renderuje — podglad tez nie.
 *
 * Swiadoma roznica: elementy nie sa linkami ani przyciskami (podglad nie nawiguje), wiec
 * ikona ma `role="img"` z nazwa serwisu.
 */

const ICON_PROPS = { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true } as const;

const ICONS = {
    facebook: (
        <svg {...ICON_PROPS} fill="currentColor">
            <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
        </svg>
    ),
    instagram: (
        <svg
            {...ICON_PROPS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
    ),
    tiktok: (
        <svg {...ICON_PROPS} fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.53a6.27 6.27 0 00-.79-.05A6.34 6.34 0 003.15 15.65a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.22a8.16 8.16 0 004.76 1.52V7.3a4.82 4.82 0 01-1-.61z" />
        </svg>
    ),
    linkedin: (
        <svg {...ICON_PROPS} fill="currentColor">
            <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
        </svg>
    ),
    x: (
        <svg {...ICON_PROPS} fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    ),
} as const;

/** Kolejnosc i tla jak w rzedzie ikon `service-card.tsx`. */
const ICON_ROW = [
    { key: 'facebook', label: 'Facebook', className: 'bg-[#1877F2]' },
    {
        key: 'instagram',
        label: 'Instagram',
        className: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
    },
    { key: 'tiktok', label: 'TikTok', className: 'bg-black dark:bg-gray-900' },
    { key: 'linkedin', label: 'LinkedIn', className: 'bg-[#0A66C2]' },
    { key: 'x', label: 'X', className: 'bg-black dark:bg-gray-900' },
] as const;

const PILL_CLASSES =
    'flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-medium';

function Pill({ className, children }: { className: string; children: ReactNode }): JSX.Element {
    return <span className={cn(PILL_CLASSES, className)}>{children}</span>;
}

export function PreviewSocials({
    socials,
    whatsappNumber,
}: Pick<BusinessPreview, 'socials' | 'whatsappNumber'>): JSX.Element | null {
    const t = useTranslations('MapCard');
    const icons = ICON_ROW.filter(({ key }) => socials[key] !== undefined);
    const hasWhatsapp = whatsappNumber !== null || socials.whatsapp !== undefined;
    const hasTelegram = socials.telegram !== undefined;

    if (icons.length === 0 && !hasWhatsapp && !hasTelegram) return null;

    return (
        <div className="space-y-4">
            {icons.length > 0 && (
                <div className="flex gap-3">
                    {icons.map(({ key, label, className }) => (
                        <span
                            key={key}
                            role="img"
                            aria-label={label}
                            className={cn(
                                'flex size-9 items-center justify-center rounded-full text-white',
                                className,
                            )}
                        >
                            {ICONS[key]}
                        </span>
                    ))}
                </div>
            )}
            {(hasWhatsapp || hasTelegram) && (
                <div className="grid grid-cols-2 gap-2">
                    {hasWhatsapp && (
                        <Pill className="border-[#22c55e] bg-[#f0fdf4] text-[#15803d] dark:border-[#16a34a] dark:bg-[#052e16]/20 dark:text-[#4ade80]">
                            <MessageCircle size={18} aria-hidden />
                            {t('whatsapp')}
                        </Pill>
                    )}
                    {hasTelegram && (
                        <Pill className="border-[#229ed9] bg-[#eff9fd] text-[#1b7fad] dark:border-[#1b7fad] dark:bg-[#082f3f]/20 dark:text-[#5ec3e8]">
                            <Send size={18} aria-hidden />
                            {t('telegram')}
                        </Pill>
                    )}
                </div>
            )}
        </div>
    );
}
