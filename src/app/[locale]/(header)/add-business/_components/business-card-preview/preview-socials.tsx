'use client';

import { MessageCircle, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX, ReactNode } from 'react';

import { SOCIAL_NETWORKS } from '@/app/[locale]/(main)/_components/service-socials/service-socials';
import type { BusinessPreview } from '@/lib/add-business/types';
import { cn } from '@/lib/utilities';

/**
 * Social media i komunikatory na podgladzie karty. Ikony, kolejnosc i kolory bierze z listy
 * `SOCIAL_NETWORKS` karty katalogu, wiec nowa siec pojawia sie w obu miejscach naraz.
 * Przyciski WhatsApp (numer, a bez niego link) i Telegram — jak na karcie.
 *
 * Swiadoma roznica: elementy nie sa linkami ani przyciskami (podglad nie nawiguje), wiec
 * ikona ma `role="img"` z nazwa serwisu.
 */

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
    const icons = SOCIAL_NETWORKS.filter(({ key }) => socials[key] !== undefined);
    const hasWhatsapp = whatsappNumber !== null || socials.whatsapp !== undefined;
    const hasTelegram = socials.telegram !== undefined;

    if (icons.length === 0 && !hasWhatsapp && !hasTelegram) return null;

    return (
        <div className="space-y-4">
            {icons.length > 0 && (
                <div className="flex flex-wrap gap-3">
                    {icons.map(({ key, label, className, icon }) => (
                        <span
                            key={key}
                            role="img"
                            aria-label={label}
                            className={cn(
                                'flex size-9 items-center justify-center rounded-full text-white',
                                className,
                            )}
                        >
                            {icon}
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
