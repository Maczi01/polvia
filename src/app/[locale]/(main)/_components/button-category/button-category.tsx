import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utilities';

const buttonVariants = cva(
    'inline-flex items-center md:justify-around justify-start gap-2 whitespace-nowrap rounded-md text-sm font-medium ' +
    'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ' +
    'active:scale-95',
    {
        variants: {
            variant: {
                default: 'bg-gray-400 text-white hover:bg-gray-600 dark:bg-zinc-600 dark:hover:bg-zinc-500',

                red: 'bg-gradient-to-r from-[#F86187] to-[#E94464] text-white ' +
                    'dark:from-[#FF6B94] dark:to-[#F85177] dark:shadow-lg',

                green: 'bg-gradient-to-r from-[#00AA66] to-[#49C55E] text-white ' +
                    'dark:from-[#00CC77] dark:to-[#5BD66F] dark:shadow-lg',

                orange: 'bg-gradient-to-r from-[#FB6D13] to-[#FF9D00] text-white ' +
                    'dark:from-[#FF7E26] dark:to-[#FFAD1A] dark:shadow-lg',

                blue: 'bg-gradient-to-r from-[#298EED] to-[#78BCFD] text-white ' +
                    'dark:from-[#3B9EFF] dark:to-[#89CCFF] dark:shadow-lg',

                gold: 'bg-gradient-to-r from-[#DFB02F] to-[#ECC438] text-white ' +
                    'dark:from-[#F2C341] dark:to-[#FFD74A] dark:text-white dark:shadow-lg',

                violet: 'bg-gradient-to-r from-[#DD81FF] to-[#FF0929] text-white ' +
                    'dark:from-[#E894FF] dark:to-[#FF1A3C] dark:shadow-lg',

                aqua: 'bg-gradient-to-r from-[#00B5D7] to-[#0989A2] text-white ' +
                    'dark:from-[#1AC5E8] dark:to-[#1A99B3] dark:shadow-lg',

                lightblue: 'bg-gradient-to-r from-[#2F59E5] to-[#44C1F2] text-white ' +
                    'dark:from-[#4A6AFF] dark:to-[#55D1FF] dark:shadow-lg',

                darkviolet: 'bg-gradient-to-r from-[#6441A5] to-[#2a0845] text-white ' +
                    'dark:from-[#7551B6] dark:to-[#3B1956] dark:shadow-lg',

                starfall: 'bg-gradient-to-r from-[#4b1248] to-[#cc9e54] text-white ' +
                    'dark:from-[#5C2359] dark:to-[#DDAF65] dark:shadow-lg',

                overworld: 'bg-gradient-to-r from-[#4776e6] to-[#8e54e9] text-white ' +
                    'dark:from-[#5887F7] dark:to-[#9F65FA] dark:shadow-lg',

                oversky: 'bg-gradient-to-r from-[#3D0DAF] to-[#0998A2] text-white ' +
                    'dark:from-[#5887F7] dark:to-[#9F65FA] dark:shadow-lg',

                coral: 'bg-gradient-to-r from-[#2563EB] to-[#FACC15] text-white ' +
                    'dark:from-[#3B73FB] dark:to-[#FFDC26] dark:shadow-lg',

                mojito: 'bg-gradient-to-r from-[#1488CC] to-[#2B32B2] text-white ' +
                    'dark:from-[#1488CC] dark:to-[#2B32B2] dark:shadow-lg',

                removeFilter: 'bg-red-500 text-white hover:bg-red-600 ' +
                    'dark:bg-red-600 dark:hover:bg-red-500 dark:shadow-lg',
            },
            size: {
                default: 'h-9 rounded-md px-4 py-0',
            },
            isSelected: {
                true: 'shadow-lg ring-2 ring-white/20 ring-offset-0 ' +
                    'dark:ring-zinc-400/50 dark:shadow-xl dark:shadow-zinc-900/20',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    text: string;
    image: string;
    isSelected?: boolean;
}

const ButtonCategory = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, text, image, isSelected, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, isSelected, className }))}
                ref={ref}
                {...props}
            >
                <Image
                    src={image}
                    alt="icon"
                    width={16}
                    height={16}
                    className={cn('transition-all duration-200')}
                />
                <span className={cn('transition-colors')}>{text}</span>
            </Comp>
        );
    },
);
ButtonCategory.displayName = 'ButtonCategory';

export { ButtonCategory, buttonVariants };