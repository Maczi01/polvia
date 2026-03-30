'use client';

import Image from 'next/image';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge/badge';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utilities';
import { Button } from '@/components/ui/button/button';
import { mapCategoryToBadgeColor, VOIVODESHIP_TO_MESSAGE_KEY } from '@/lib/consts';
import { Clock, Globe, Mail, MapPin, Phone, MessageCircle, Navigation, User } from 'lucide-react';
import { PartialService } from '@/types';
import { PopupMarkerData } from '@/app/[locale]/(main)/_components/overview-map/overview-map';
import { VerifiedBadge } from '@/components/ui/verified-badge/verified-badge';

const LANGUAGE_FLAGS: Record<string, { src: string; alt: string }> = {
    pl: { src: '/icons/pl.svg', alt: 'Polish' },
    en: { src: '/icons/gb.svg', alt: 'English' },
    ru: { src: '/icons/ru.svg', alt: 'Russian' },
    uk: { src: '/icons/ua.svg', alt: 'Ukrainian' },
    be: { src: '/icons/by.svg', alt: 'Belarusian' },
};

const FacebookIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
);

const LinkedInIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
    </svg>
)

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

const TelegramIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0 12 12 0 0011.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
);

const ViberIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" fill="currentColor">
        <path d="M11.4 0C9.473.028 5.333.344 3.02 2.467 1.302 4.187.541 6.783.453 9.96c-.088 3.178-.199 9.139 5.603 10.784l.007.006-.004 2.457s-.04.993.616 1.196c.792.245 1.258-.51 2.014-1.326.415-.448.986-1.105 1.42-1.607 3.912.329 6.92-.423 7.265-.539.794-.267 5.283-.834 6.016-6.806.755-6.159-.354-10.048-2.342-11.806C19.083.76 14.57.027 11.4 0zm.525 1.8h.088c2.738.022 6.717.551 8.376 2.04 1.658 1.467 2.622 4.985 1.964 10.3-.618 5.01-4.252 5.342-4.923 5.568-.287.096-2.854.731-6.2.531 0 0-2.456 2.967-3.224 3.74-.12.121-.263.168-.357.145-.132-.033-.168-.19-.165-.42l.026-4.06c-4.863-1.382-4.576-6.398-4.503-9.065.073-2.667.695-4.89 2.129-6.31C6.584 2.858 9.28 1.834 11.925 1.8zM11.8 4.6a.525.525 0 00-.007 1.05c1.326.013 2.462.483 3.382 1.381.92.899 1.427 2.168 1.446 3.463a.525.525 0 001.05-.012c-.023-1.572-.64-3.083-1.754-4.175-1.113-1.091-2.49-1.693-4.11-1.707H11.8zm-3.233.9c-.263-.005-.54.073-.804.293-.547.456-.987 1.003-1.162 1.26a2.3 2.3 0 00-.38 1.532c.094.674.416 1.458.973 2.39.855 1.487 1.98 2.982 3.398 4.365 1.06 1.034 2.598 2.145 3.87 2.87.927.529 2.17 1.103 3.067 1.1.59-.003 1.07-.204 1.453-.665l.006-.006c.35-.427.607-.882.652-1.26a.898.898 0 00-.326-.818l-2.07-1.593a.911.911 0 00-1.048-.092l-1.2.652c-.16.088-.393.064-.534-.052l-.006-.006a15.094 15.094 0 01-1.634-1.532 14.22 14.22 0 01-1.396-1.716l-.005-.007c-.098-.15-.112-.363-.014-.518l.67-1.14a.911.911 0 00-.04-1.058L10.05 5.92a.898.898 0 00-.685-.408 1.27 1.27 0 00-.198-.012zm3.493 1.1a.525.525 0 00-.022 1.05c.793.017 1.438.322 1.967.863.529.54.838 1.265.856 2.048a.525.525 0 001.05-.024c-.023-1.05-.44-1.96-1.15-2.684-.71-.723-1.586-1.222-2.694-1.252h-.007z" />
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
    className,
}: {
    href: string;
    children: React.ReactNode;
    className?: string;
}) => (
    <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
            'flex size-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80',
            className,
        )}
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
            slug,
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
            verified,
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
        const tCounties = useTranslations('MapPage.counties');
        const locale = useLocale();

        const COLLAPSE_MS = 300;
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

        const translatedVoivodeship = useMemo(() => {
            if (!voivodeship) return '';
            const messageKey = VOIVODESHIP_TO_MESSAGE_KEY[voivodeship];
            return messageKey ? tCounties(messageKey) : voivodeship;
        }, [voivodeship, tCounties]);

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

        const addressParts = [street, city, translatedVoivodeship]
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
            : socials?.whatsapp ?? null;

        const navigateLink = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        const profileHref = slug
            ? (locale === 'pl' ? `/firma/${slug}` : `/${locale}/firma/${slug}`)
            : null;

        const hasSocials = socials && (socials.facebook || socials.instagram || socials.tiktok || socials.telegram || socials.viber);

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
                            <div className="flex items-center gap-2">
                                <h3
                                    className={cn(
                                        'text-base font-bold text-gray-900 dark:text-gray-100 md:text-lg',
                                        expanded ? 'break-words' : 'truncate',
                                    )}
                                >
                                    {name}
                                </h3>
                                {verified && <VerifiedBadge className="shrink-0" />}
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                {expanded
                                    ? description || `${city}${translatedVoivodeship ? `, ${translatedVoivodeship}` : ''}`
                                    : `${city}${translatedVoivodeship ? `, ${translatedVoivodeship}` : ''}`}
                            </p>
                        </div>

                        <Button
                            variant="ghost"
                            size="arrow"
                            className="card-expand-button absolute right-1 top-1 shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 md:right-0 md:top-0"
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
                    <div className="mt-2 space-y-4 px-1 pb-1 md:px-0 md:pb-0">
                        {/* Detail rows + Languages */}
                        <div className="flex gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                            <div className="flex min-w-0 flex-1 flex-col gap-3">
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

                                {/* Email */}
                                {email && (
                                    <a
                                        href={`mailto:${email}`}
                                        className="flex items-center gap-2.5 text-sm transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <Mail
                                            size={16}
                                            className="shrink-0 text-gray-400"
                                        />
                                        <span className="text-blue-600 hover:underline dark:text-blue-400">
                                            {email}
                                        </span>
                                    </a>
                                )}
                            </div>

                            {/* Languages - top right */}
                            {languages && languages.length > 0 && (
                                <div className="flex shrink-0 flex-col items-end">
                                    <span className="text-xs font-semibold tracking-wider text-gray-400 dark:text-gray-500">
                                        {t('languages')}
                                    </span>
                                    <div className="mt-1.5 flex gap-1.5">
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
                        </div>

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
                                    <SocialLink href={socials.facebook} className="bg-[#1877F2]">
                                        <FacebookIcon />
                                    </SocialLink>
                                )}
                                {socials.instagram && (
                                    <SocialLink href={socials.instagram} className="bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]">
                                        <InstagramIcon className="text-white" />
                                    </SocialLink>
                                )}
                                {socials.tiktok && (
                                    <SocialLink href={socials.tiktok} className="bg-black dark:bg-gray-900">
                                        <TikTokIcon />
                                    </SocialLink>
                                )}
                                {socials?.telegram && (
                                    <SocialLink href={socials.telegram} className="bg-[#26A5E4]">
                                        <TelegramIcon />
                                    </SocialLink>
                                )}
                                {socials?.viber && (
                                    <SocialLink href={socials.viber} className="bg-[#7360F2]">
                                        <ViberIcon />
                                    </SocialLink>
                                )}
                                {socials?.linkedin && (
                                    <SocialLink href={socials.linkedin} className="bg-[#0A66C2]">
                                        <LinkedInIcon />
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
                                        className="flex w-full items-center justify-center gap-2 rounded-full border border-[#f97316] bg-[#fff7ed] px-3 py-2.5 text-sm font-medium text-[#c2410c] transition-colors hover:bg-[#ffedd5] dark:border-[#ea580c] dark:bg-[#431407]/20 dark:text-[#fb923c] dark:hover:bg-[#431407]/40"
                                    >
                                        <Phone size={18} />
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
                                        className="flex w-full items-center justify-center gap-2 rounded-full border border-[#22c55e] bg-[#f0fdf4] px-3 py-2.5 text-sm font-medium text-[#15803d] transition-colors hover:bg-[#dcfce7] dark:border-[#16a34a] dark:bg-[#052e16]/20 dark:text-[#4ade80] dark:hover:bg-[#052e16]/40"
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
                                    className="flex w-full items-center justify-center gap-2 rounded-full border border-[#3b82f6] bg-[#eff6ff] px-3 py-2.5 text-sm font-medium text-[#1d4ed8] transition-colors hover:bg-[#dbeafe] dark:border-[#2563eb] dark:bg-[#172554]/20 dark:text-[#60a5fa] dark:hover:bg-[#172554]/40"
                                >
                                    <Navigation size={18} />
                                    {t('navigate')}
                                </button>
                            </Link>
                        </div>

                        {/* View profile link */}
                        {profileHref && (
                            <div className="pt-1">
                                <Link
                                    href={profileHref}
                                    onClick={e => e.stopPropagation()}
                                    className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    <User size={18} />
                                    {t('viewProfile')}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        );
    },
);

ServiceCard.displayName = 'ServiceCard';
