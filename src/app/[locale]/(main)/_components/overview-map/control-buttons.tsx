import Image from 'next/image';
import React, { useState } from 'react';
import { cn } from '@/lib/utilities';
import { Button } from '@/components/ui/button/button';
import { useIsMobile } from '@/hooks/use-is-mobile';

type ControlButtonsProps = {
    // handleReset: () => void;
    handleZoomIn: () => void;
    handleZoomOut: () => void;
};

export const ControlButtons = ({
                                   handleZoomIn,
                                   handleZoomOut,
                               }: ControlButtonsProps) => {
    const isMobile = useIsMobile({ breakpoint: 768 });

    return (
        <div className={cn(
            "absolute right-2 top-2 flex flex-col",
            isMobile ? "gap-4" : "gap-2"
        )}>
            <Button
                variant="green"
                onClick={handleZoomIn}
                className={cn(
                    'transition-transform duration-150 active:scale-90 border-2 border-slate-800',
                    isMobile ? 'w-12 h-12' : 'w-10 h-10'
                )}
                aria-label="Zoom in"
            >
                <Image
                    src="/icons/loopplus.svg"
                    alt="arrow"
                    width={32}
                    height={32}
                    className={cn(
                        'px-0',
                        isMobile ? 'size-8' : 'size-6'
                    )}
                />
            </Button>
            <Button
                variant="green"
                onClick={handleZoomOut}
                className={cn(
                    'transition-transform duration-150 active:scale-90 border-2 border-slate-800',
                    isMobile ? 'w-12 h-12' : 'w-10 h-10'
                )}
                aria-label="Zoom out"
            >
                <Image
                    src="/icons/loopminus.svg"
                    alt="arrow"
                    width={32}
                    height={32}
                    className={cn(
                        'px-0',
                        isMobile ? 'size-8' : 'size-6'
                    )}
                />
            </Button>
        </div>
    );
};