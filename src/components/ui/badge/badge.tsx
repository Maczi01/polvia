import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utilities';

const badgeVariants = cva(
    'inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:rounded-md',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
                destructive:
                    'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
                outline: 'text-foreground',
                red: 'bg-gradient-to-r from-[#F86187]/30 to-[#E94464]/30',
                green: 'bg-gradient-to-r from-[#00AA66]/30 to-[#49C55E]/30',
                orange: 'bg-gradient-to-r from-[#FB6D13]/60 to-[#FF9D00]/50',
                blue: 'bg-gradient-to-r from-[#298EED]/30 to-[#78BCFD]/30',
                gold: 'bg-gradient-to-r from-[#DFB02F]/90 to-[#ECC438]/90',
                violet: 'bg-gradient-to-r from-[#8632A5]/10 to-[#C46CE4]/30',
                aqua: 'bg-gradient-to-r from-[#00B5D7]/30 to-[#0989A2]/30',
                lightblue: 'bg-gradient-to-r from-[#2F59E5] to-[#44C1F2]/70 dark:from-[#4A6AFF]/80 to-[#44C1F2]/80',
                darkviolet: 'bg-gradient-to-r from-[#6441A5]/30 to-[#2a0845]/30',
                starfall: 'bg-gradient-to-r from-[#4b1248]/30 to-[#cc9e54]/30',
                overworld: 'bg-gradient-to-r from-[#4776e6] to-[#8e54e9]',
                mojito: 'bg-gradient-to-r from-[#1488CC]/10 to-[#2B32B2]/20',
                pinkred: 'bg-gradient-to-r from-[#DD81FF]/80 to-[#FF0929]/70',
                sapphire: 'bg-gradient-to-r from-[#4776e6]/80 to-[#8e54e9]/80',
                antricot: 'bg-gradient-to-r from-[#0989A2]/80 to-[#00B5D7]/80',
                others: 'bg-gradient-to-r from-[#1488CC] to-[#2B32B2]',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

// Map variants to their corresponding text colors
const variantTextColors: Record<string, string> = {
    default: 'text-primary-foreground',
    secondary: 'text-secondary-foreground',
    destructive: 'text-destructive-foreground  dark:text-white' ,
    outline: 'text-foreground  dark:text-white' ,
    red: 'text-black  dark:text-white' ,
    green: 'text-black  dark:text-white' ,
    orange: 'text-black]  dark:text-white' ,
    blue: 'text-[#2F59E5]   dark:text-white' ,
    gold: 'text-black  dark:text-white' ,
    violet: 'text-[#C46CE4]  dark:text-white' ,
    aqua: 'text-black  dark:text-white' ,
    lightblue: 'text-white' ,
    darkviolet: 'text-black  dark:text-white' ,
    starfall: 'text-[#bc7504]  dark:text-white' ,
    overworld: 'text-[#8e54e9]  dark:text-white' ,
    mojito: 'text-[#f45c43]  dark:text-white' ,
    others: 'text-white  dark:text-white' ,
};

const badgeVariantsList = [
    'red',
    'green',
    'orange',
    'blue',
    'gold',
    'violet',
    'aqua',
    'lightblue',
    'darkviolet',
    'starfall',
    'overworld',
    'mojito',
] as const;

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {
    label: string;
    index?: number;
}

function Badge({ className, variant = 'default', label = 'empty', index, ...props }: BadgeProps) {
    const variantToUse =
        index === undefined ? variant : badgeVariantsList[index % badgeVariantsList.length];
    const textColorClass =
        variantTextColors[variantToUse as keyof typeof variantTextColors] ||
        variantTextColors.default;
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    return (
        <div
            className={cn('whitespace-nowrap', badgeVariants({ variant: variantToUse }), className)}
            {...props}
        >
            <span className={textColorClass}>{capitalized}</span>
        </div>
    );
}

export { Badge, badgeVariants };
