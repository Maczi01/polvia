import Image from 'next/image';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utilities';
import { Button } from '@/components/ui/button/button';
import { useIsMobile } from '@/hooks/use-is-mobile';

type MapControlsProps = {
    handleZoomIn: () => void;
    handleZoomOut: () => void;
    handleReset: () => void;
    mapRef?: React.RefObject<any>; // Add map reference for smooth zooming
};

export const MapControls = ({ handleZoomIn, handleZoomOut, handleReset, mapRef }: MapControlsProps) => {
    const [isRotating, setIsRotating] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const [isZoomingIn, setIsZoomingIn] = useState(false);
    const [isZoomingOut, setIsZoomingOut] = useState(false);
    const isMobile = useIsMobile({ breakpoint: 768 });
    
    // Refs for continuous zooming
    const zoomIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressRef = useRef(false);
    const touchStartTimeRef = useRef<number>(0);

    // Prevent context menu and image saving on long press
    const preventContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    // Smooth zoom functions
    const smoothZoom = useCallback((direction: 'in' | 'out') => {
        if (!mapRef?.current?.getMap) return;
        
        const map = mapRef.current.getMap();
        const currentZoom = map.getZoom();
        const step = isMobile ? 0.08 : 0.06; // Smaller steps for smoother zooming
        const maxZoom = 20;
        const minZoom = 1;
        
        const newZoom = direction === 'in' 
            ? Math.min(maxZoom, currentZoom + step)
            : Math.max(minZoom, currentZoom - step);
            
        if (newZoom !== currentZoom) {
            map.setZoom(newZoom);
        }
    }, [mapRef, isMobile]);

    // Start continuous zooming
    const startContinuousZoom = useCallback((direction: 'in' | 'out') => {
        // Clear any existing intervals
        if (zoomIntervalRef.current) {
            clearInterval(zoomIntervalRef.current);
        }
        
        // Set the appropriate zooming state
        if (direction === 'in') {
            setIsZoomingIn(true);
        } else {
            setIsZoomingOut(true);
        }
        
        // Start continuous zooming
        zoomIntervalRef.current = setInterval(() => {
            smoothZoom(direction);
        }, 50); // 50ms for smooth animation
    }, [smoothZoom]);

    // Stop continuous zooming
    const stopContinuousZoom = useCallback(() => {
        if (zoomIntervalRef.current) {
            clearInterval(zoomIntervalRef.current);
            zoomIntervalRef.current = null;
        }
        if (zoomTimeoutRef.current) {
            clearTimeout(zoomTimeoutRef.current);
            zoomTimeoutRef.current = null;
        }
        setIsZoomingIn(false);
        setIsZoomingOut(false);
        isLongPressRef.current = false;
    }, []);

    // Handle touch events to prevent default behaviors
    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        touchStartTimeRef.current = Date.now();
    };

    const handleResetClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsRotating(true);
        setIsClicked(true);
        handleReset();
        setTimeout(() => {
            setIsRotating(false);
            setIsClicked(false);
        }, 500);
    };

    // Zoom In handlers
    const handleZoomInStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Single smooth zoom for short click
        smoothZoom('in');
        
        // Start continuous zooming after delay
        zoomTimeoutRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            startContinuousZoom('in');
        }, 300); // Start continuous zoom after 300ms
    };

    const handleZoomInEnd = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const touchDuration = Date.now() - touchStartTimeRef.current;
        
        // If it was a short press and not continuous zooming, use fallback
        if (touchDuration < 300 && !isLongPressRef.current && !mapRef?.current?.getMap) {
            handleZoomIn();
        }
        
        stopContinuousZoom();
    };

    // Zoom Out handlers
    const handleZoomOutStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Single smooth zoom for short click
        smoothZoom('out');
        
        // Start continuous zooming after delay
        zoomTimeoutRef.current = setTimeout(() => {
            isLongPressRef.current = true;
            startContinuousZoom('out');
        }, 300); // Start continuous zoom after 300ms
    };

    const handleZoomOutEnd = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const touchDuration = Date.now() - touchStartTimeRef.current;
        
        // If it was a short press and not continuous zooming, use fallback
        if (touchDuration < 300 && !isLongPressRef.current && !mapRef?.current?.getMap) {
            handleZoomOut();
        }
        
        stopContinuousZoom();
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopContinuousZoom();
        };
    }, [stopContinuousZoom]);

    return (
        <div
            className={cn(
                'select-none absolute right-2 top-2 flex flex-col items-end',
                isMobile ? 'gap-3 rounded-lg backdrop-blur-sm bg-white/20 dark:bg-black/20 border-2 border-gray-300 dark:border-gray-600 shadow-lg p-2' : 'gap-2'
            )}
            style={{
                touchAction: 'manipulation', // Improve touch responsiveness
                WebkitTouchCallout: 'none', // Disable callout on iOS
                WebkitUserSelect: 'none', // Disable text selection
                userSelect: 'none'
            }}
        >
            {/* Reset Button */}
            <Button
                    variant="green"
                    className={cn(
                        'select-none transition-transform duration-150 active:scale-90 border-2 border-slate-800',
                        isMobile ? 'w-12 h-12' : 'w-24 h-10',
                        isClicked && 'scale-95',
                    )}
                    onClick={handleResetClick}
                    onContextMenu={preventContextMenu}
                    onTouchStart={handleTouchStart}
                    style={{
                        touchAction: 'manipulation',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                    }}
                    aria-label="Reset map"
                >
                    <Image
                        src="/icons/rotate.svg"
                        alt="reset"
                        width={32}
                        height={32}
                        className={cn(
                            'select-none transition-transform duration-500 px-0 pointer-events-none',
                            isMobile ? 'size-8' : 'size-4',
                            isRotating && 'rotate-360',
                        )}
                        style={{
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            pointerEvents: 'none'
                        }}
                        draggable={false}
                        unoptimized
                    />
                    {!isMobile && <span className="ml-2 font-bold text-white pointer-events-none">Reset</span>}
                </Button>

            {/* Zoom In Button */}
            <Button
                    variant="green"
                    onMouseDown={handleZoomInStart}
                    onMouseUp={handleZoomInEnd}
                    onMouseLeave={handleZoomInEnd}
                    onTouchStart={(e) => {
                        handleTouchStart(e);
                        handleZoomInStart(e);
                    }}
                    onTouchEnd={handleZoomInEnd}
                    onTouchCancel={handleZoomInEnd}
                    onContextMenu={preventContextMenu}
                    className={cn(
                        'select-none transition-transform duration-150 active:scale-90 border-2 border-slate-800',
                        isMobile ? 'w-12 h-12' : 'w-10 h-10',
                        isZoomingIn && 'scale-95 bg-green-700', // Visual feedback when continuously zooming
                    )}
                    style={{
                        touchAction: 'manipulation',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                    }}
                    aria-label="Zoom in"
                >
                    <Image
                        src="/icons/loopplus.svg"
                        alt="zoom in"
                        width={32}
                        height={32}
                        className={cn('select-none px-0 pointer-events-none', isMobile ? 'size-8' : 'size-6')}
                        style={{
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            pointerEvents: 'none'
                        }}
                        draggable={false}
                        unoptimized
                    />
                </Button>

            {/* Zoom Out Button */}
            <Button
                    variant="green"
                    onMouseDown={handleZoomOutStart}
                    onMouseUp={handleZoomOutEnd}
                    onMouseLeave={handleZoomOutEnd}
                    onTouchStart={(e) => {
                        handleTouchStart(e);
                        handleZoomOutStart(e);
                    }}
                    onTouchEnd={handleZoomOutEnd}
                    onTouchCancel={handleZoomOutEnd}
                    onContextMenu={preventContextMenu}
                    className={cn(
                        'select-none transition-transform duration-150 active:scale-90 border-2 border-slate-800',
                        isMobile ? 'w-12 h-12' : 'w-10 h-10',
                        isZoomingOut && 'scale-95 bg-green-700', // Visual feedback when continuously zooming
                    )}
                    style={{
                        touchAction: 'manipulation',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                    }}
                    aria-label="Zoom out"
                >
                    <Image
                        src="/icons/loopminus.svg"
                        alt="zoom out"
                        width={32}
                        height={32}
                        className={cn('select-none px-0 pointer-events-none', isMobile ? 'size-8' : 'size-6')}
                        style={{
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            pointerEvents: 'none'
                        }}
                        draggable={false}
                        unoptimized
                    />
                </Button>
        </div>
    );
};