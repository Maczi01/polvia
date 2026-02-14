import Image from 'next/image';
import React, { useState } from 'react';
import { cn } from '@/lib/utilities';
import { Button } from '@/components/ui/button/button';
import { useIsMobile } from '@/hooks/use-is-mobile';

type ResetButtonProps = {
    handleReset: () => void;
};

export const ResetButton = ({
                                handleReset,
                            }: ResetButtonProps) => {
    const [isRotating, setIsRotating] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const isMobile = useIsMobile({ breakpoint: 768 });

    const handleClick = () => {
        setIsRotating(true);
        setIsClicked(true);
        handleReset();
        setTimeout(() => {
            setIsRotating(false);
            setIsClicked(false);
        }, 500);
    };

    return (
        <div className={cn(
            "absolute right-2 flex flex-col gap-2",
            isMobile ? "top-44" : "top-28"
        )}>
            <Button
                variant="green"
                className={cn(
                    'transition-transform duration-150 active:scale-90 border-2 border-slate-800',
                    isMobile ? 'w-12 h-12' : 'w-24 h-10',
                    isClicked && 'scale-95',
                )}
                onClick={handleClick}
            >
                <Image
                    src="/icons/rotate.svg"
                    alt="reset"
                    width={32}
                    height={32}
                    className={cn(
                        'transition-transform duration-500 px-0',
                        isMobile ? 'size-8' : 'size-4',
                        isRotating && 'rotate-360',
                    )}
                />
                {!isMobile && (
                    <span className="font-bold text-white ml-2">Reset</span>
                )}
            </Button>
        </div>
    );
};