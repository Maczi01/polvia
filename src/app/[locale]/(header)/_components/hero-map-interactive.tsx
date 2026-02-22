'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { HERO_PIN_MAP, type HeroPin } from './hero-map-data';
import { HeroMapTooltip } from './hero-map-tooltip';

const SHOW_DELAY = 120;
const HIDE_DELAY = 120;

type Props = {
    ariaLabel: string;
};

export function HeroMapInteractive({ ariaLabel }: Props) {
    const isMobile = useIsMobile({ breakpoint: 768 });

    const containerRef = useRef<HTMLDivElement>(null);
    const svgWrapperRef = useRef<HTMLDivElement>(null);
    const svgInjectedRef = useRef(false);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [svgLoaded, setSvgLoaded] = useState(false);
    const [activePin, setActivePin] = useState<HeroPin | null>(null);
    const [visible, setVisible] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

    // Fetch and inject SVG once via ref — never touched by React again
    useEffect(() => {
        if (svgInjectedRef.current) return;
        const wrapper = svgWrapperRef.current;
        if (!wrapper) return;

        fetch('/logo/hero.svg')
            .then((res) => res.text())
            .then((text) => {
                if (svgInjectedRef.current) return;
                svgInjectedRef.current = true;
                const cleaned = text.replace(/<\?xml[^?]*\?>\s*/, '');
                wrapper.innerHTML = cleaned;
                setSvgLoaded(true);
            })
            .catch(() => {});
    }, []);

    // Compute tooltip position from SVG viewBox coords
    const computeTooltipPosition = useCallback(
        (pin: HeroPin) => {
            const container = containerRef.current;
            if (!container) return {};

            const svg = container.querySelector('svg');
            if (!svg) return {};

            // Convert pin position (SVG viewBox coords) to screen pixels
            const pt = svg.createSVGPoint();
            pt.x = pin.position.x;
            pt.y = pin.position.y;

            const ctm = svg.getScreenCTM();
            if (!ctm) return {};

            const screenPt = pt.matrixTransform(ctm);
            const containerRect = container.getBoundingClientRect();

            // The pin graphic is ~51 SVG units tall above its anchor point.
            // Convert that to screen pixels using the current scale factor.
            const pinHeightSvg = 58;
            const pinHeightPx = pinHeightSvg * ctm.a; // ctm.a = horizontal scale ≈ vertical for uniform scaling

            let left = screenPt.x - containerRect.left - 130; // center 260px card
            // Place the card's bottom edge above the pin tip with a small gap
            const top = screenPt.y - containerRect.top - pinHeightPx - 8;

            const maxLeft = containerRect.width - 260;
            if (left < 0) left = 0;
            if (left > maxLeft) left = Math.max(0, maxLeft);

            return {
                left: `${left}px`,
                top: `${top}px`,
                transform: 'translateY(-100%)',
            };
        },
        [],
    );

    // Show a pin's tooltip
    const showPin = useCallback(
        (pin: HeroPin) => {
            setActivePin(pin);
            setTooltipStyle(computeTooltipPosition(pin));
            setVisible(true);
        },
        [computeTooltipPosition],
    );

    // Hide tooltip
    const hideTooltip = useCallback(() => {
        setVisible(false);
    }, []);

    // Clear all timers
    const clearTimers = useCallback(() => {
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
        }
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    // Event delegation: mouseover on SVG container
    const handleMouseOver = useCallback(
        (e: React.MouseEvent) => {
            if (isMobile) return;

            const target = e.target as Element;
            const mwGroup = target.closest('.mw');
            if (!mwGroup) return;

            const category = mwGroup.getAttribute('data-category');
            if (!category) return;

            const pin = HERO_PIN_MAP.get(category);
            if (!pin) return;

            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }

            if (activePin && activePin.svgLabel !== pin.svgLabel) {
                if (showTimerRef.current) {
                    clearTimeout(showTimerRef.current);
                    showTimerRef.current = null;
                }
                showPin(pin);
                return;
            }

            if (!visible) {
                if (showTimerRef.current) {
                    clearTimeout(showTimerRef.current);
                }
                showTimerRef.current = setTimeout(() => {
                    showPin(pin);
                    showTimerRef.current = null;
                }, SHOW_DELAY);
            }
        },
        [isMobile, activePin, visible, showPin],
    );

    // Event delegation: mouseout on SVG container
    const handleMouseOut = useCallback(
        (e: React.MouseEvent) => {
            if (isMobile) return;

            const target = e.target as Element;
            const mwGroup = target.closest('.mw');
            if (!mwGroup) return;

            if (showTimerRef.current) {
                clearTimeout(showTimerRef.current);
                showTimerRef.current = null;
            }

            hideTimerRef.current = setTimeout(() => {
                hideTooltip();
                hideTimerRef.current = null;
            }, HIDE_DELAY);
        },
        [isMobile, hideTooltip],
    );

    // Card hover: keep visible
    const handleCardEnter = useCallback(() => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    const handleCardLeave = useCallback(() => {
        hideTimerRef.current = setTimeout(() => {
            hideTooltip();
            hideTimerRef.current = null;
        }, HIDE_DELAY);
    }, [hideTooltip]);

    // Recalculate position on resize
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !activePin || !visible) return;

        const observer = new ResizeObserver(() => {
            setTooltipStyle(computeTooltipPosition(activePin));
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [activePin, visible, computeTooltipPosition]);

    // Cleanup timers on unmount
    useEffect(() => clearTimers, [clearTimers]);

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full"
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
        >
            {/* SVG wrapper — innerHTML set once via ref, React never re-touches it */}
            <div
                ref={svgWrapperRef}
                className="h-full w-full [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain dark:brightness-90 dark:contrast-110"
                aria-label={ariaLabel}
                role="img"
            />

            {/* Skeleton shown until SVG loads */}
            {!svgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-3/4 w-3/4 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                </div>
            )}

            {/* Tooltip overlay */}
            {activePin && !isMobile && (
                <HeroMapTooltip
                    pin={activePin}
                    style={tooltipStyle}
                    visible={visible}
                    onMouseEnter={handleCardEnter}
                    onMouseLeave={handleCardLeave}
                />
            )}
        </div>
    );
}
