import Link from 'next/link';
import Image from 'next/image';
import { PartialService, View } from '@/types';
import { cn } from '@/lib/utilities';
import { formatAddress } from '@/lib/consts';
import { Button } from '@/components/ui/button/button';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useViewState } from '@/hooks/use-view-state';

type Props = {
    selectedService?: PartialService | null;
    handleClose: () => void;
    currentView: View;
};

export const MobileBottomMarkerCard = ({
                                           selectedService,
                                           handleClose,
                                           currentView
                                       }: Props) => {
    const t = useTranslations('Popup');
    const { handleViewChange } = useViewState();

    // Early return for better readability
    if (!selectedService || currentView === 'list') {
        return null;
    }

    // Extracted variables for better readability
    const image = selectedService.image
        ? `/services/${selectedService.image}`
        : '/default.png';
    const address = formatAddress(selectedService);
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${selectedService.latitude},${selectedService.longitude}`;

    const handleListViewClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleViewChange('list');
    };

    return (
        <div
            className={cn(
                "fixed bottom-0 left-0 z-10 w-full translate-y-0 rounded-t-xl border-t-4",
                "border-[#C52289] bg-white px-4 py-3 shadow-xl transition-transform duration-300",
                "ease-in-out dark:bg-gray-800 dark:shadow-gray-900/50 md:hidden"
            )}
        >
            {/* Main content with header */}
            <div className="flex items-start gap-3">
                {/* Service image - smaller */}
                <div className="shrink-0">
                    <Image
                        src={image}
                        alt={`${selectedService.name} image`}
                        className={cn(
                            "overflow-hidden rounded-full border-2 border-gray-300 object-cover",
                            "dark:border-gray-600"
                        )}
                        width={80}
                        height={80}
                        priority
                    />
                </div>

                {/* Service details */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Header with title and close button */}
                    <div className="mb-1 flex items-center justify-between">
                        <h3 className="truncate pr-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {selectedService.name}
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/95 p-0 text-gray-700 shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-200 hover:scale-110 hover:bg-red-500 hover:text-white hover:shadow-[0_6px_12px_rgba(239,68,68,0.4),0_3px_6px_rgba(239,68,68,0.2)] active:scale-95 dark:bg-gray-800/95"
                            onClick={handleClose}
                            aria-label={t('close', { fallback: 'Close' })}
                        >
                            <Image
                                src="/buttons/close.svg"
                                alt=""
                                width={32}
                                height={32}
                                className="dark:brightness-0 dark:invert"
                            />
                        </Button>
                    </div>

                    {/* Address */}
                    <div className="mb-3 flex items-center gap-2">
                        <Image
                            src="/icons/location.svg"
                            alt=""
                            width={16}
                            height={16}
                            className="shrink-0 dark:brightness-0 dark:invert"
                        />
                        <span className="text-sm leading-tight text-muted-foreground dark:text-gray-400">
                            {address}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {/* List view button - LEFT */}
                        <Button
                            variant="explore"
                            size="sm"
                            className="flex-1 rounded-full"
                            onClick={handleListViewClick}
                            aria-label={t('viewInList', { fallback: 'View in list' })}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="mr-1.5 text-[#49C55E] dark:text-green-400"
                            >
                                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                            </svg>
                            <span className="text-sm font-medium text-[#49C55E] dark:text-green-400">
                                {t('list', { fallback: 'Lista' })}
                            </span>
                        </Button>

                        {/* Google Maps button - RIGHT */}
                        <Button
                            variant="explore"
                            size="sm"
                            className="flex-1 rounded-full bg-[#5db3f0]"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                            }}
                            aria-label={t('navigate', { fallback: 'Navigate with Google Maps' })}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="dark:white mr-1.5 text-white"
                            >
                                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                            </svg>
                            <span className="dark:white text-sm font-medium text-white">
                                {t('navigate', { fallback: 'Dojazd' })}
                            </span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
