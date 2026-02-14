'use client';

import Image from 'next/image';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge/badge';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utilities';
import { Button } from '@/components/ui/button/button';
import { mapCategoryToBadgeColor } from '@/lib/consts';
import { Copy, Mail, Map, MapPin, Pin } from 'lucide-react';
import { useViewState } from '@/hooks/use-view-state';
import { PartialService } from '@/types';
import { PopupMarkerData } from '@/app/[locale]/(main)/_components/overview-map/overview-map';

type CardProps = {
    className?: string;
    index: number;
    handleFlyTo: (latitude: number, longitude: number) => void;
    resetMap: () => void;
    handleHoverPlace: (id: number | null) => void;
    setCardToExpand: (id: number | null) => void;
    cardToExpand: number | null;
    setPopup: (popup: PopupMarkerData | null) => void;
} & PartialService;

const handleIncreasePopularityCounter = async (serviceId: number) => {
    await fetch('/api/increase-popularity-counter', {
        method: 'POST',
        body: JSON.stringify({ serviceId }),
        headers: { 'Content-Type': 'application/json' },
    });
};

export const ServiceCard = forwardRef<HTMLDivElement, CardProps>(
    (
        {
            id,
            className,
            image,
            name,
            city,
            category,
            street,
            county,
            tags,
            postcode,
            phoneNumber,
            email,
            webpage,
            description,
            latitude,
            longitude,
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
        const [emailCopied, setEmailCopied] = useState(false);
        const [isEmailHovering, setIsEmailHovering] = useState(false);
        const [isExpanding, setIsExpanding] = useState(false);
        const t = useTranslations('MapCard');
        const { handleViewChange } = useViewState();

        const COLLAPSE_MS = 300; // Increased for smoother animation
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

        const handleMapButtonClick = () => {
            handleViewChange('map');
        };

        //! Culprit
        // Improved height calculation with Safari-specific fixes
        // simpler fix - just measure scrollHeight directly without resetting styles
        useEffect(() => {
            const content = contentRef.current;
            if (!content) return;

            if (expanded) {
                setIsExpanding(true);

                // Set initial collapsed state
                content.style.height = '0px';
                content.style.maxHeight = '0px';
                content.style.overflow = 'hidden';

                // Measure height by reading scrollHeight of inner content
                const height = content.scrollHeight;

                // Force reflow - critical for Safari
                void content.offsetHeight;

                // Animate to expanded state
                // Use double RAF for Safari compatibility
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (content && expanded) {
                            content.style.height = `${height}px`;
                            content.style.maxHeight = `${height}px`;
                            setContentHeight(height);

                            // Clear expanding flag after animation
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
                    // Get current height before starting collapse
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

        // Simplified ref handling
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

        // Improved card expansion with mobile-specific scrolling
        const handleCardExpand = useCallback(
            (e?: React.MouseEvent) => {
                if (e) {
                    const target = e.target as HTMLElement;
                    if (
                        target.closest('a') ||
                        (target.closest('button') && !target.closest('.card-expand-button')) ||
                        target.closest('.email-clickable-area')
                    ) {
                        return;
                    }
                }

                if (expanded) {
                    setCardToExpand(null);
                    handleHoverPlace(null);
                    return;
                }

                // Handle expansion with improved mobile scrolling
                if (cardToExpand !== null) {
                    setCardToExpand(null);

                    setTimeout(() => {
                        setCardToExpand(id);
                        handleIncreasePopularityCounter(id);

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

                        // Mobile-specific scroll handling
                        if (isMobile && cardRef.current) {
                            // Wait for expansion to start, then scroll
                            setTimeout(() => {
                                if (cardRef.current) {
                                    const cardRect = cardRef.current.getBoundingClientRect();
                                    const viewportHeight = window.innerHeight;

                                    // Only scroll if card is not already at top
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

                // Direct expansion
                setCardToExpand(id);
                handleIncreasePopularityCounter(id);

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

                // Mobile scroll for direct expansion
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
            ],
        );

        const handleCopyEmail = async () => {
            if (email) {
                try {
                    await navigator.clipboard.writeText(email);
                    setEmailCopied(true);
                    setTimeout(() => setEmailCopied(false), 2000);
                } catch (error) {
                    console.error('Failed to copy email:', error);
                }
            }
        };

        const addressParts = [street, postcode, city, county]
            .map(part => part?.trim())
            .filter(Boolean);
        const address = addressParts.join(', ');

        const img = image ? `/services/${image.trimEnd()}` : '/default.png';
        const badgeColor = mapCategoryToBadgeColor(category);

        return (
            <Card
                ref={setRefs}
                data-service-id={id}
                className={cn(
                    'transition-all duration-300 ease-in-out bg-white dark:bg-gray-800',
                    expanded ? `border-b-4 border-[#C52289] z-[99]` : 'h-auto z-auto',
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
                <div className="md:hidden">
                    {/* Mobile Layout */}
                    <div className="relative p-3">
                        <div className="flex items-start">
                            <div className="mr-3 shrink-0 pt-1">
                                <Image
                                    src={img}
                                    alt="service image"
                                    className="overflow-hidden rounded-full border border-gray-300 object-cover dark:border-gray-600"
                                    width={48}
                                    height={48}
                                />
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col pr-12">
                                <h3
                                    className={`${expanded ? 'break-words' : 'truncate'} text-base font-bold text-gray-900 dark:text-gray-100`}
                                >
                                    {name}
                                </h3>
                                <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                                    <Image
                                        src="/icons/location.svg"
                                        alt="location"
                                        width={16}
                                        height={16}
                                        className="mr-1 shrink-0 dark:brightness-0 dark:invert"
                                    />
                                    <span className="max-w-full break-words">
                                        {expanded ? address : city || county}
                                    </span>
                                </div>
                            </div>

                            <Button
                                variant="ghost"
                                size="arrow"
                                className="card-expand-button absolute right-3 top-3 shrink-0 rounded-full bg-green-100 dark:bg-green-900/30"
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

                        <div className="mt-2 flex max-w-[80%] flex-wrap gap-1.5 overflow-hidden">
                            {tags
                                ?.slice(0, 2)
                                .map((tag, idx) => (
                                    <Badge
                                        label={tag?.toString() || ''}
                                        key={idx}
                                        color="gray"
                                        variant={badgeColor}
                                    />
                                ))}
                        </div>
                    </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:block">
                    <div className="flex shrink-0 flex-row justify-between pb-2">
                        <CardContent className="flex flex-row items-start gap-x-3">
                            <div className="shrink-0 pt-1">
                                <Image
                                    src={img}
                                    alt="service image"
                                    className="overflow-hidden rounded-full border-2 border-gray-300 object-cover dark:border-gray-600"
                                    width={68}
                                    height={68}
                                />
                            </div>

                            <div className="min-w-0 flex-1 flex-col">
                                <div className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    {name}
                                </div>
                                <div className="mt-2 flex items-center">
                                    <MapPin className="size-5 mr-1" color="#737373" />
                                    <div className="break-words text-sm text-muted-foreground dark:text-gray-400">
                                        {expanded
                                            ? address
                                            : `${city}${county ? `, ${county}` : ''}`}
                                    </div>
                                </div>
                            </div>
                        </CardContent>

                        <CardContent className="flex flex-row items-center gap-x-6">
                            <div className="flex gap-x-2">
                                {!expanded &&
                                    tags
                                        ?.slice(0, 3)
                                        .map((tag, idx) => (
                                            <Badge
                                                label={tag || ''}
                                                key={idx}
                                                color="gray"
                                                variant={badgeColor}
                                            />
                                        ))}
                            </div>
                            <Button
                                variant="explore"
                                className={cn(
                                    'card-expand-button w-36 shrink-0 transition-all duration-300',
                                    isHovering
                                        ? 'ring-2 ring-[#49C55E]/50 dark:ring-green-400/50'
                                        : '',
                                )}
                                onClick={e => {
                                    e.stopPropagation();
                                    handleCardExpand(e);
                                }}
                            >
                                <span className="font-bold text-[#49C55E] dark:text-green-400">
                                    {expanded ? t('showLess') : t('showMore')}
                                </span>
                                <Image
                                    src="/icons/arrow.svg"
                                    alt="arrow"
                                    width={16}
                                    height={16}
                                    className={cn(
                                        'transition-transform duration-500 dark:brightness-0 dark:invert',
                                        expanded ? '' : 'rotate-90',
                                    )}
                                />
                            </Button>
                        </CardContent>
                    </div>
                </div>

                {/* Expandable Content */}
                <div
                    ref={contentRef}
                    style={{
                        height: expanded ? (isExpanding ? `${contentHeight}px` : 'auto') : '0px',
                        maxHeight: expanded ? (isExpanding ? `${contentHeight}px` : 'none') : '0px',
                        overflow: expanded && !isExpanding ? 'visible' : 'hidden',
                        transition: `all ${COLLAPSE_MS}ms ease-in-out`,
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <CardContent className="mt-4 flex flex-col border-t border-gray-200 pt-4 dark:border-gray-700 md:border-b">
                        {description && (
                            <div className="mb-6 ml-4 mt-2 text-sm text-muted-foreground dark:text-gray-400">
                                {description}
                            </div>
                        )}
                        <div className="flex flex-row items-end justify-between">
                            {(phoneNumber || email || webpage) && (
                                <div className="mb-4 ml-4 flex flex-col gap-y-2">
                                    {phoneNumber && (
                                        <a
                                            href={`tel:${phoneNumber}`}
                                            className="flex cursor-pointer flex-row items-center gap-x-2 rounded p-0 m-0 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Image
                                                src="/icons/phone.svg"
                                                alt="icon"
                                                width={18}
                                                height={18}
                                                className="shrink-0 dark:brightness-0 dark:invert"
                                            />
                                            <div className="truncate text-sm text-black dark:text-gray-100">
                                                {phoneNumber}
                                            </div>
                                        </a>
                                    )}

                                    {email && (
                                        <div className="relative">
                                            <div
                                                className="flex cursor-pointer flex-row items-center gap-x-2 rounded p-0 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 email-clickable-area"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    handleCopyEmail();
                                                }}
                                                onMouseEnter={() => setIsEmailHovering(true)}
                                                onMouseLeave={() => setIsEmailHovering(false)}
                                            >
                                                <div className="relative">
                                                    {isEmailHovering ? (
                                                        <Copy className="m-0 size-4 shrink-0 p-0" />
                                                    ) : (
                                                        <Mail className="m-0 size-4 shrink-0 p-0" />
                                                    )}
                                                </div>
                                                <div className="truncate text-sm text-black dark:text-gray-100">
                                                    <span className="md:hidden">
                                                        {email.length > 20
                                                            ? t('mail') || 'Mail'
                                                            : email}
                                                    </span>
                                                    <span className="hidden md:inline">
                                                        {email}
                                                    </span>
                                                </div>
                                            </div>

                                            {emailCopied && (
                                                <div className="animate-fade-in absolute -top-10 left-0 z-50 whitespace-nowrap rounded bg-green-500 px-2 py-1 text-xs text-white shadow-lg">
                                                    Email copied!
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {webpage && (
                                        <div className="flex flex-row items-center gap-x-2">
                                            <Image
                                                src="/icons/page.svg"
                                                alt="icon"
                                                width={18}
                                                height={18}
                                                className="shrink-0 dark:brightness-0 dark:invert"
                                            />
                                            <Link
                                                href={webpage}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="max-w-[200px] truncate text-sm text-black hover:text-blue-500 hover:underline dark:text-gray-100 dark:hover:text-blue-400"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                {t('page')}
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}
                            <Button
                                variant="explore"
                                className="w-24 shrink-0 md:hidden"
                                onClick={e => {
                                    e.stopPropagation();
                                    handleMapButtonClick();
                                }}
                            >
                                <Map
                                    color="#49C55E"
                                    className="mr-2 size-5 bg-transparent dark:text-green-400"
                                />
                                <span className="font-bold text-[#49C55E] dark:text-green-400">
                                    {t('map')}
                                </span>
                            </Button>
                        </div>
                    </CardContent>

                    <CardContent className="ml-4 mt-4 hidden md:flex">
                        <div className="flex gap-x-2">
                            {tags?.map(tag => (
                                <Badge
                                    label={tag?.toString() || ''}
                                    key={tag}
                                    color="gray"
                                    variant={badgeColor}
                                />
                            ))}
                        </div>
                    </CardContent>
                </div>
            </Card>
        );
    },
);

ServiceCard.displayName = 'ServiceCard';
