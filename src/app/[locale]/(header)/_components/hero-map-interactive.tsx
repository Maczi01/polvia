'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { HERO_PINS, HERO_PIN_MAP, type HeroPin } from './hero-map-data';
import { HeroMapTooltip } from './hero-map-tooltip';
import type { VoivodeshipStats } from '@/lib/queries';

const SHOW_DELAY = 120;
const HIDE_DELAY = 120;

const AUTO_BOUNCE_LEAD_MS = 0; // show tooltip immediately with bounce
const AUTO_BOUNCE_MS = 2400; // 2 full bounces at 1.2s each
const AUTO_FADE_MS = 500; // fade-out duration after bounce stops
const AUTO_BREAK_MS = 600; // pause between pins
const AUTO_START_MS = 4200; // after pin fade-in animations finish

type Props = {
    ariaLabel: string;
    voivodeshipStats: VoivodeshipStats[];
};

export function HeroMapInteractive({ ariaLabel, voivodeshipStats }: Props) {
    const isMobile = useIsMobile({ breakpoint: 768 });

    // Merge DB stats into static pin data
    const enrichedPinMap = useMemo(() => {
        const statsMap = new Map(voivodeshipStats.map((s) => [s.voivodeship, s]));
        const map = new Map<string, HeroPin>();
        for (const pin of HERO_PINS) {
            const stats = statsMap.get(pin.voivodeshipKey);
            map.set(pin.svgLabel, stats
                ? { ...pin, placesCount: stats.companiesCount, categoriesCount: stats.categoriesCount }
                : pin,
            );
        }
        return map;
    }, [voivodeshipStats]);

    const enrichedPins = useMemo(
        () => HERO_PINS.map((p) => enrichedPinMap.get(p.svgLabel) ?? p),
        [enrichedPinMap],
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const svgWrapperRef = useRef<HTMLDivElement>(null);
    const svgInjectedRef = useRef(false);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-cycle refs
    const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAutoIndexRef = useRef(-1);
    const userHoveringRef = useRef(false);
    const autoShowingRef = useRef(false);

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

    // Inject / update service-count badges on each pin marker
    useEffect(() => {
        if (!svgLoaded) return;
        const wrapper = svgWrapperRef.current;
        if (!wrapper) return;

        const NS = 'http://www.w3.org/2000/svg';

        for (const pin of enrichedPins) {
            const mw = wrapper.querySelector(`.mw[data-category="${pin.svgLabel}"]`);
            if (!mw) continue;

            const count = pin.placesCount;
            if (!count) continue;

            // Badge position: top-right of the pin in .mw local coords
            // The pin shape spans roughly (-19.4, -50) to (19.4, 0)
            const bx = 16;
            const by = -42;
            const r = 12;

            const jm = mw.querySelector('.jm');
            if (!jm) continue;

            let badge = jm.querySelector('.pin-badge') as SVGGElement | null;
            if (badge) {
                const text = badge.querySelector('text');
                if (text) text.textContent = String(count);
            } else {
                badge = document.createElementNS(NS, 'g') as SVGGElement;
                badge.setAttribute('class', 'pin-badge');

                // White border ring
                const border = document.createElementNS(NS, 'circle');
                border.setAttribute('cx', String(bx));
                border.setAttribute('cy', String(by));
                border.setAttribute('r', String(r + 2));
                border.setAttribute('fill', 'white');

                // Dark filled circle
                const circle = document.createElementNS(NS, 'circle');
                circle.setAttribute('cx', String(bx));
                circle.setAttribute('cy', String(by));
                circle.setAttribute('r', String(r));
                circle.setAttribute('fill', '#1e293b');

                // Count text — use dy for vertical centering (more reliable than dominant-baseline)
                const text = document.createElementNS(NS, 'text');
                text.setAttribute('x', String(bx));
                text.setAttribute('y', String(by));
                text.setAttribute('dy', '0.35em');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'white');
                text.setAttribute('font-size', '12');
                text.setAttribute('font-weight', '700');
                text.setAttribute('font-family', 'system-ui, sans-serif');
                text.textContent = String(count);

                badge.append(border);
                badge.append(circle);
                badge.append(text);
                jm.append(badge);
            }
        }
    }, [svgLoaded, enrichedPins]);

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

            // The pin graphic is ~50 SVG units tall above its anchor point.
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

    // Toggle bounce class on the active pin's SVG element
    const setActivePinBounce = useCallback((category: string | null) => {
        const wrapper = svgWrapperRef.current;
        if (!wrapper) return;
        wrapper.querySelectorAll('.jm-active').forEach((el) => {
            // Skip removal if this element already belongs to the target category
            const parentMw = el.closest('.mw');
            if (category && parentMw?.getAttribute('data-category') === category) return;
            el.classList.remove('jm-active');
            (el as SVGElement).style.animationDelay = '';
        });
        if (category) {
            const jm = wrapper.querySelector(`.mw[data-category="${category}"] .jm`) as SVGElement | null;
            if (jm && !jm.classList.contains('jm-active')) {
                jm.style.animationDelay = '0s';
                jm.classList.add('jm-active');
            }
        }
    }, []);

    // Show a pin's tooltip
    const showPin = useCallback(
        (pin: HeroPin) => {
            setActivePin(pin);
            setTooltipStyle(computeTooltipPosition(pin));
            setVisible(true);
            setActivePinBounce(pin.svgLabel);
        },
        [computeTooltipPosition, setActivePinBounce],
    );

    // Hide tooltip
    const hideTooltip = useCallback(() => {
        setVisible(false);
        userHoveringRef.current = false;
        setActivePinBounce(null);
    }, [setActivePinBounce]);

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

    // ── Auto-cycle: reuse the full HeroMapTooltip ───────────────────
    useEffect(() => {
        if (!svgLoaded || isMobile) return;

        const showNext = () => {
            if (userHoveringRef.current) {
                autoTimerRef.current = setTimeout(showNext, AUTO_BREAK_MS);
                return;
            }

            let idx: number;
            do {
                idx = Math.floor(Math.random() * enrichedPins.length);
            } while (idx === lastAutoIndexRef.current && enrichedPins.length > 1);
            lastAutoIndexRef.current = idx;

            const pin = enrichedPins[idx];
            autoShowingRef.current = true;

            // Step 1: Start bounce only
            setActivePinBounce(pin.svgLabel);

            // Step 2: After lead time, show tooltip + start bounce together
            autoTimerRef.current = setTimeout(() => {
                if (!autoShowingRef.current || userHoveringRef.current) {
                    autoTimerRef.current = setTimeout(showNext, AUTO_BREAK_MS);
                    return;
                }
                showPin(pin);

                // Step 3: Wait for 2 full bounces, then stop bounce
                autoTimerRef.current = setTimeout(() => {
                    if (autoShowingRef.current && !userHoveringRef.current) {
                        setActivePinBounce(null);
                    }

                    // Step 4: Fade out tooltip after bounce stops
                    autoTimerRef.current = setTimeout(() => {
                        if (autoShowingRef.current && !userHoveringRef.current) {
                            setVisible(false);
                            userHoveringRef.current = false;
                        }

                        // Step 5: Break, then next pin
                        autoTimerRef.current = setTimeout(showNext, AUTO_BREAK_MS);
                    }, AUTO_FADE_MS);
                }, AUTO_BOUNCE_MS);
            }, AUTO_BOUNCE_LEAD_MS);
        };

        autoTimerRef.current = setTimeout(showNext, AUTO_START_MS);

        return () => {
            if (autoTimerRef.current) {
                clearTimeout(autoTimerRef.current);
                autoTimerRef.current = null;
            }
        };
    }, [svgLoaded, isMobile, computeTooltipPosition, showPin, hideTooltip, setActivePinBounce, enrichedPins]);

    // Event delegation: mouseover on SVG container
    const handleMouseOver = useCallback(
        (e: React.MouseEvent) => {
            if (isMobile) return;

            const target = e.target as Element;
            const mwGroup = target.closest('.mw');
            if (!mwGroup) return;

            const category = mwGroup.getAttribute('data-category');
            if (!category) return;

            const pin = enrichedPinMap.get(category);
            if (!pin) return;

            // User takes over from auto-cycle
            userHoveringRef.current = true;
            autoShowingRef.current = false;

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
        [isMobile, activePin, visible, showPin, enrichedPinMap],
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
        userHoveringRef.current = true;
        autoShowingRef.current = false;
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

            {/* Tooltip overlay — shared by auto-cycle and hover */}
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
