import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utilities';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm ' +
    'font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 ' +
    'focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none ' +
    '[&_svg]:size-4 [&_svg]:shrink-0' +
    '[&_svg]:transition-transform [&_svg]:duration-300 hover:[&_svg]:scale-110',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground shadow hover:bg-g/90',
                destructive:
                    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
                outline:
                    'border-input hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-accent-foreground text-md',
                secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
                ghost: 'hover:bg-accent hover:text-accent-foreground',

                link: 'text-primary underline-offset-4 hover:underline',
                active: 'bg-green text-primary-foreground text-md',
                explore:
                    'bg-gradient-to-r from-[#00AA66]/10 to-[#49C55E]/20 md:px-4 md:py-2 px-2 py-2 w-9 h-9 rounded-full flex items-center justify-center',
                green: 'bg-green md:px-2 md:py-2 w-12 h-12 rounded-full flex items-center justify-center',
                slate: 'bg-slate-800 md:px-2 md:py-2 w-9 h-9 rounded-full flex items-center justify-center',
                orange: 'bg-gradient-to-r from-[#FB6D13] to-[#FF9D00] md:px-2 md:py-2 w-9 h-9 rounded-full flex items-center justify-center',
                exploreMap:
                    'border-2 border-green bg-green text-white ' +
                    'hover:bg-green hover:border-green-700 ' +
                    'focus-visible:ring-green-300 ' +
                    'shadow-lg hover:shadow-md',

                addBusiness:
                    'border-2 border-green-600 bg-white text-green-600 ' +
                    'hover:bg-green-600/80 hover:text-white ' +
                    'focus-visible:ring-green-300 ' +
                    'font-bold ' +
                    'shadow-lg hover:shadow-md ' +
                    'dark:bg-transparent dark:border-green-400 dark:text-green-400 ' +
                    'dark:hover:bg-green-400 dark:hover:text-gray-900 ' +
                    'dark:focus-visible:ring-green-400/50 ' +
                    'dark:shadow-lg dark:shadow-zinc-900/20',
            },
            size: {
                // default: "h-9 md:px-2 px-4 md:py-2 py-4 rounded-full ",
                default: 'h-9 rounded-full md:px-2 px-0 md:py-2 ',
                sm: 'h-8 rounded-md px-0 text-xs',
                lg: 'h-10 rounded-md px-8',
                icon: 'h-9 w-9',
                arrow: 'h-12 w-12',
                mobileLink: "text-md",
                hero: 'px-1 md:px-6 py-2 text-base md:py-3', // Updated for taller mobile buttons
                // hero: 'px-6 py-4 text-lg md:px-8 md:py-5 md:text-xl', // Better mobile/desktop scaling
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
