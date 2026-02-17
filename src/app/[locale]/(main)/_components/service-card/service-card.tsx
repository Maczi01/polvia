'use client';

import Image from 'next/image';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge/badge';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utilities';
import { Button } from '@/components/ui/button/button';
import { mapCategoryToBadgeColor } from '@/lib/consts';
import { Clock, Globe, MapPin, Phone, MessageCircle, Navigation } from 'lucide-react';
import { PartialService } from '@/types';
import { PopupMarkerData } from '@/app/[locale]/(main)/_components/overview-map/overview-map';

const LANGUAGE_FLAGS: Record<string, { src: string; alt: string }> = {
    pl: { src: '/icons/pl.svg', alt: 'Polish' },
    en: { src: '/icons/gb.svg', alt: 'English' },
    ru: { src: '/icons/ru.svg', alt: 'Russian' },
    uk: { src: '/icons/ua.svg', alt: 'Ukrainian' },
};

const FacebookIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.53a6.27 6.27 0 00-.79-.05A6.34 6.34 0 003.15 15.65a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.22a8.16 8.16 0 004.76 1.52V7.3a4.82 4.82 0 01-1-.61z" />
    </svg>
);

type CardProps = {
    className?: string;
    index: number;
    handleFlyTo: (latitude: number, longitude: number) => void;
    resetMap: () => void;
    handleHoverPlace: (id: string | null) => void;
    setCardToExpand: (id: string | null) => void;
    cardToExpand: string | null;
    setPopup: (popup: PopupMarkerData | null) => void;
} & PartialService;

const handleIncreasePopularityCounter = async (serviceId: string) => {
    await fetch('/api/increase-popularity-counter', {
        method: 'POST',
        body: JSON.stringify({ serviceId }),
        headers: { 'Content-Type': 'application/json' },
    });
};

const getDomainFromUrl = (url: string): string => {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

const getTodayHours = (
    openingHours: Record<string, { open: string; close: string }> | undefined | null,
): { open: string; close: string } | null => {
    if (!openingHours) return null;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    return openingHours[today] || null;
};

const SocialLink = ({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) => (
    <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-9 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-200"
        onClick={e => e.stopPropagation()}
    >
        {children}
    </Link>
);

export const ServiceCard = forwardRef<HTMLDivElement, CardProps>(
    (
        {
            id,
            serviceId,
            className,
            image,
            name,
            city,
            category,
            street,
            voivodeship,
            tags,
            postcode,
            phoneNumber,
            email,
            webpage,
            description,
            latitude,
            longitude,
            openingHours,
            languages,
            socials,
            whatsappNumber,
            handleFlyTo,
            resetMap,
            handleHoverPlace,
            setCardToExpand,
            cardToExpand,
            setPopup,
        },
        ref,
    ) => {
        const expanded = cardToExpand === id;
        const contentRef = useRef<HTMLDivElement>(null);
        const cardRef = useRef<HTMLDivElement>(null);
        const [contentHeight, setContentHeight] = useState<number>(0);
        const [isHovering, setIsHovering] = useState<boolean>(false);
        const [isExpanding, setIsExpanding] = useState(false);
        const t = useTranslations('MapCard');

        const COLLAPSE_MS = 300;
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

        const todayHours = useMemo(() => getTodayHours(openingHours), [openingHours]);

        useEffect(() => {
            const content = contentRef.current;
            if (!content) return;

            if (expanded) {
                setIsExpanding(true);
                content.style.height = '0px';
                content.style.maxHeight = '0px';
                content.style.overflow = 'hidden';

                const height = content.scrollHeight;
                void content.offsetHeight;

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (content && expanded) {
                            content.style.height = `${height}px`;
                            content.style.maxHeight = `${height}px`;
                            setContentHeight(height);

                            setTimeout(() => {
                                setIsExpanding(false);
                                if (content && expanded) {
                                    content.style.height = 'auto';
                                    content.style.overflow = 'visible';
                                }
                            }, COLLAPSE_MS);
                        }
                    });
                });
            } else {
                if (content.style.height === 'auto') {
                    const currentHeight = content.scrollHeight;
                    content.style.height = `${currentHeight}px`;
                    content.style.maxHeight = `${currentHeight}px`;
                    content.style.overflow = 'hidden';
                }

                void content.offsetHeight;

                requestAnimationFrame(() => {
                    if (content) {
                        content.style.height = '0px';
                        content.style.maxHeight = '0px';
                        setContentHeight(0);
                    }
                });
            }
        }, [expanded, COLLAPSE_MS]);

        const setRefs = useCallback(
            (element: HTMLDivElement | null) => {
                if (typeof ref === 'function') {
                    ref(element);
                } else if (ref) {
                    ref.current = element;
                }
                cardRef.current = element;
            },
            [ref],
        );

        const handleCardExpand = useCallback(
            (e?: React.MouseEvent) => {
                if (e) {
                    const target = e.target as HTMLElement;
                    if (
                        target.closest('a') ||
                        (target.closest('button') && !target.closest('.card-expand-button'))
                    ) {
                        return;
                    }
                }

                if (expanded) {
                    setCardToExpand(null);
                    handleHoverPlace(null);
                    return;
                }

                if (cardToExpand !== null) {
                    setCardToExpand(null);

                    setTimeout(() => {
                        setCardToExpand(id);
                        handleIncreasePopularityCounter(serviceId);

                        if (latitude !== undefined && longitude !== undefined) {
                            handleFlyTo(longitude, latitude);
                            setPopup({
                                id,
                                name,
                                image: image ? `/services/${image.trimEnd()}` : '/default.png',
                                latitude,
                                longitude,
                                category,
                                place: city!,
                            });
                        }
                        handleHoverPlace(id);

                        if (isMobile && cardRef.current) {
                            setTimeout(() => {
                                if (cardRef.current) {
                                    const cardRect = cardRef.current.getBoundingClientRect();
                                    if (cardRect.top > 100) {
                                        cardRef.current.scrollIntoView({
                                            behavior: 'smooth',
                                            block: 'start',
                                            inline: 'nearest',
                                        });
                                    }
                                }
                            }, 50);
                        }
                    }, COLLAPSE_MS);
                    return;
                }

                setCardToExpand(id);
                handleIncreasePopularityCounter(serviceId);

                if (latitude !== undefined && longitude !== undefined) {
                    handleFlyTo(longitude, latitude);
                    setPopup({
                        id,
                        name,
                        image: image ? `/services/${image.trimEnd()}` : '/default.png',
                        latitude,
                        longitude,
                        category,
                        place: city!,
                    });
                }
                handleHoverPlace(id);

                if (isMobile && cardRef.current) {
                    setTimeout(() => {
                        if (cardRef.current) {
                            cardRef.current.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                                inline: 'nearest',
                            });
                        }
                    }, 100);
                }
            },
            [
                expanded,
                cardToExpand,
                id,
                latitude,
                longitude,
                name,
                image,
                category,
                city,
                handleFlyTo,
                setPopup,
                handleHoverPlace,
                setCardToExpand,
                isMobile,
                COLLAPSE_MS,
                serviceId,
            ],
        );

        const addressParts = [street, city, voivodeship]
            .map(part => part?.trim())
            .filter(Boolean);
        const address = addressParts.join(', ');

        const img = image ? `/services/${image.trimEnd()}` : '/default.png';
        const badgeColor = mapCategoryToBadgeColor(category);
        const domain = webpage ? getDomainFromUrl(webpage) : '';
        const webpageHref = webpage
            ? webpage.startsWith('http')
                ? webpage
                : `https://${webpage}`
            : '';

        const whatsappLink = whatsappNumber
            ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`
            : socials?.whatsapp
              ? socials.whatsapp
              : phoneNumber
                ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`
                : null;

        const navigateLink = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

        const hasSocials = socials && (socials.facebook || socials.instagram || socials.tiktok);

        const actionButtonCount = [phoneNumber, whatsappLink, true].filter(Boolean).length;

        return (
            <Card
                ref={setRefs}
                data-service-id={id}
                className={cn(
                    'transition-all duration-300 ease-in-out bg-white dark:bg-gray-800',
                    expanded ? 'border-t-4 border-[#C52289] z-[99]' : 'h-auto z-auto',
                    'flex flex-col overflow-hidden border-gray-200 dark:border-gray-700',
                    !expanded &&
                        'cursor-pointer hover:bg-green-50/30 dark:hover:bg-green-900/10 hover:border-green-500/30 dark:hover:border-green-400/30',
                    className,
                )}
                onMouseEnter={() => {
                    handleHoverPlace(id);
                    setIsHovering(true);
                }}
                onMouseLeave={() => {
                    handleHoverPlace(null);
                    setIsHovering(false);
                }}
                onClick={handleCardExpand}
            >
                {/* Header - always visible */}
                <div className="relative p-1 md:p-0">
                    <div className="flex items-start gap-3">
                        <div className="shrink-0">
                            <Image
                                src={img}
                                alt="service image"
                                className="overflow-hidden rounded-full border-2 border-gray-200 object-cover dark:border-gray-600"
                                width={56}
                                height={56}
                            />
                        </div>

                        <div className="min-w-0 flex-1 pr-10">
                            <h3
                                className={cn(
                                    'text-base font-bold text-gray-900 dark:text-gray-100 md:text-lg',
                                    expanded ? 'break-words' : 'truncate',
                                )}
                            >
                                {name}
                            </h3>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                {expanded
                                    ? description || `${city}${voivodeship ? `, ${voivodeship}` : ''}`
                                    : `${city}${voivodeship ? `, ${voivodeship}` : ''}`}
                            </p>
                        </div>

                        <Button
                            variant="ghost"
                            size="arrow"
                            className="card-expand-button absolute right-1 top-1 shrink-0 rounded-full bg-green-100 md:right-0 md:top-0 dark:bg-green-900/30"
                            onClick={e => {
                                e.stopPropagation();
                                handleCardExpand(e);
                            }}
                        >
                            <Image
                                src="/icons/arrow.svg"
                                alt="arrow"
                                width={24}
                                height={24}
                                className={cn(
                                    'transition-transform duration-500 dark:brightness-0 dark:invert',
                                    expanded ? '' : 'rotate-90',
                                )}
                            />
                        </Button>
                    </div>

                    {/* Tags when collapsed */}
                    {!expanded && tags && tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {tags.slice(0, isMobile ? 2 : 3).map((tag, idx) => (
                                <Badge
                                    label={tag?.toString() || ''}
                                    key={idx}
                                    color="gray"
                                    variant={badgeColor}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Expandable Content */}
                <div
                    ref={contentRef}
                    style={{
                        height: expanded ? (isExpanding ? `${contentHeight}px` : 'auto') : '0px',
                        maxHeight: expanded
                            ? isExpanding
                                ? `${contentHeight}px`
                                : 'none'
                            : '0px',
                        overflow: expanded && !isExpanding ? 'visible' : 'hidden',
                        transition: `all ${COLLAPSE_MS}ms ease-in-out`,
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="space-y-4 px-1 pb-1 md:px-0 md:pb-0">
                        {/* Detail rows */}
                        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                            {/* Address */}
                            {address && (
                                <div className="flex items-start gap-2.5 text-sm">
                                    <MapPin
                                        size={16}
                                        className="mt-0.5 shrink-0 text-gray-400"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {address}
                                    </span>
                                </div>
                            )}

                            {/* Today's hours */}
                            {todayHours && (
                                <div className="flex items-center gap-2.5 text-sm">
                                    <Clock
                                        size={16}
                                        className="shrink-0 text-gray-400"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {t('today')}:{' '}
                                        <span className="font-semibold">
                                            {todayHours.open} – {todayHours.close}
                                        </span>
                                    </span>
                                </div>
                            )}

                            {/* Phone */}
                            {phoneNumber && (
                                <a
                                    href={`tel:${phoneNumber}`}
                                    className="flex items-center gap-2.5 text-sm transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <Phone
                                        size={16}
                                        className="shrink-0 text-gray-400"
                                    />
                                    <span className="text-gray-700 dark:text-gray-300">
                                        {phoneNumber}
                                    </span>
                                </a>
                            )}

                            {/* Website */}
                            {webpage && (
                                <Link
                                    href={webpageHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2.5 text-sm"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <Globe
                                        size={16}
                                        className="shrink-0 text-gray-400"
                                    />
                                    <span className="text-blue-600 hover:underline dark:text-blue-400">
                                        {domain}
                                    </span>
                                </Link>
                            )}
                        </div>

                        {/* Languages */}
                        {languages && languages.length > 0 && (
                            <div>
                                <span className="text-xs font-semibold tracking-wider text-gray-400 dark:text-gray-500">
                                    {t('languages')}
                                </span>
                                <div className="mt-1.5 flex gap-2">
                                    {languages.map(lang => {
                                        const flag = LANGUAGE_FLAGS[lang];
                                        if (!flag) return null;
                                        return (
                                            <Image
                                                key={lang}
                                                src={flag.src}
                                                alt={flag.alt}
                                                width={28}
                                                height={20}
                                                className="rounded-sm"
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Tags */}
                        {tags && tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag, idx) => (
                                    <Badge
                                        label={tag?.toString() || ''}
                                        key={idx}
                                        color="gray"
                                        variant={badgeColor}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Social media */}
                        {hasSocials && (
                            <div className="flex gap-3">
                                {socials.facebook && (
                                    <SocialLink href={socials.facebook}>
                                        <FacebookIcon />
                                    </SocialLink>
                                )}
                                {socials.instagram && (
                                    <SocialLink href={socials.instagram}>
                                        <InstagramIcon />
                                    </SocialLink>
                                )}
                                {socials.tiktok && (
                                    <SocialLink href={socials.tiktok}>
                                        <TikTokIcon />
                                    </SocialLink>
                                )}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div
                            className={cn(
                                'grid gap-2 pt-2',
                                actionButtonCount === 3
                                    ? 'grid-cols-3'
                                    : actionButtonCount === 2
                                      ? 'grid-cols-2'
                                      : 'grid-cols-1',
                            )}
                        >
                            {phoneNumber && (
                                <a
                                    href={`tel:${phoneNumber}`}
                                    onClick={e => e.stopPropagation()}
                                    className="block"
                                >
                                    <button
                                        type="button"
                                        className="flex w-full flex-col items-center gap-1 rounded-xl border border-gray-200 px-2 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        <Phone size={18} className="text-gray-500 dark:text-gray-400" />
                                        {t('call')}
                                    </button>
                                </a>
                            )}

                            {whatsappLink && (
                                <Link
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="block"
                                >
                                    <button
                                        type="button"
                                        className="flex w-full flex-col items-center gap-1 rounded-xl border border-green-500 bg-green-50 px-2 py-3 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 dark:border-green-600 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40"
                                    >
                                        <MessageCircle size={18} />
                                        {t('whatsapp')}
                                    </button>
                                </Link>
                            )}

                            <Link
                                href={navigateLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="block"
                            >
                                <button
                                    type="button"
                                    className="flex w-full flex-col items-center gap-1 rounded-xl border border-gray-200 px-2 py-3 text-xs font-medium text-green-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-green-400 dark:hover:bg-gray-700"
                                >
                                    <Navigation size={18} />
                                    {t('navigate')}
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </Card>
        );
    },
);

ServiceCard.displayName = 'ServiceCard';
