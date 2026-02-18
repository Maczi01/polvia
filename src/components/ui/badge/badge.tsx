import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utilities';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
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
                red: 'bg-[#FFF0F0] border-[#F5D0D0] dark:bg-[#E87676]/20 dark:border-[#E87676]/40',
                green: 'bg-[#E6F7EF] border-[#B8E6CC] dark:bg-[#00AA66]/20 dark:border-[#00AA66]/40',
                orange: 'bg-[#FFF3E0] border-[#FFD9A8] dark:bg-[#FB6D13]/20 dark:border-[#FB6D13]/40',
                blue: 'bg-[#E8F0FE] border-[#C4D9F9] dark:bg-[#298EED]/20 dark:border-[#298EED]/40',
                gold: 'bg-[#FFF8E1] border-[#F5E6A3] dark:bg-[#DFB02F]/20 dark:border-[#DFB02F]/40',
                violet: 'bg-[#F3E8F9] border-[#DFC4F0] dark:bg-[#C46CE4]/20 dark:border-[#C46CE4]/40',
                aqua: 'bg-[#E0F7FA] border-[#B2EBF2] dark:bg-[#00B5D7]/20 dark:border-[#00B5D7]/40',
                lightblue: 'bg-[#E3F2FD] border-[#BBDEFB] dark:bg-[#2F59E5]/20 dark:border-[#2F59E5]/40',
                darkviolet: 'bg-[#EDE7F6] border-[#D1C4E9] dark:bg-[#6441A5]/20 dark:border-[#6441A5]/40',
                starfall: 'bg-[#FFF3E0] border-[#FFD9A8] dark:bg-[#cc9e54]/20 dark:border-[#cc9e54]/40',
                overworld: 'bg-[#EDE7F6] border-[#D1C4E9] dark:bg-[#8e54e9]/20 dark:border-[#8e54e9]/40',
                oversky: 'bg-[#E0F2F1] border-[#B2DFDB] dark:bg-[#0998A2]/20 dark:border-[#0998A2]/40',
                mojito: 'bg-[#E8F5E9] border-[#C8E6C9] dark:bg-[#1488CC]/20 dark:border-[#1488CC]/40',
                pinkred: 'bg-[#FCE4EC] border-[#F8BBD0] dark:bg-[#DD81FF]/20 dark:border-[#DD81FF]/40',
                sapphire: 'bg-[#EDE7F6] border-[#D1C4E9] dark:bg-[#4776e6]/20 dark:border-[#4776e6]/40',
                antricot: 'bg-[#E0F7FA] border-[#B2EBF2] dark:bg-[#0989A2]/20 dark:border-[#0989A2]/40',
                others: 'bg-[#E3F2FD] border-[#BBDEFB] dark:bg-[#1488CC]/20 dark:border-[#1488CC]/40',
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
    destructive: 'text-destructive-foreground dark:text-white',
    outline: 'text-foreground dark:text-white',
    red: 'text-[#C45656] dark:text-[#E87676]',
    green: 'text-[#2E7D32] dark:text-[#49C55E]',
    orange: 'text-[#E65100] dark:text-[#FF9D00]',
    blue: 'text-[#1565C0] dark:text-[#78BCFD]',
    gold: 'text-[#F57F17] dark:text-[#ECC438]',
    violet: 'text-[#7B1FA2] dark:text-[#C46CE4]',
    aqua: 'text-[#00838F] dark:text-[#00B5D7]',
    lightblue: 'text-[#1565C0] dark:text-[#78BCFD]',
    darkviolet: 'text-[#4A148C] dark:text-[#B39DDB]',
    starfall: 'text-[#BC6C00] dark:text-[#cc9e54]',
    overworld: 'text-[#5E35B1] dark:text-[#B39DDB]',
    oversky: 'text-[#00695C] dark:text-[#4DB6AC]',
    mojito: 'text-[#1B5E20] dark:text-[#66BB6A]',
    pinkred: 'text-[#AD1457] dark:text-[#F48FB1]',
    sapphire: 'text-[#4A148C] dark:text-[#B39DDB]',
    antricot: 'text-[#00695C] dark:text-[#4DB6AC]',
    others: 'text-[#1565C0] dark:text-[#78BCFD]',
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
