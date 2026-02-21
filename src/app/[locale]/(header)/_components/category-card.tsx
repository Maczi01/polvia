import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utilities';
import { AppPathnames } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

// Enhanced card background variants with grid optimization
const categoryCardVariants = cva(
    'flex flex-col items-center justify-center rounded-xl transition-all duration-300 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 ' +
    'disabled:pointer-events-none disabled:opacity-50 active:scale-95 ' +
    'hover:scale-105 hover:shadow-lg transform-gpu ' +
    // Mobile optimizations for grid layout
    'p-3 sm:p-4 ' +
    'min-w-0 w-full ' +
    // Better touch targets for mobile
    'touch-manipulation',
    {
        variants: {
            variant: {
                default: 'bg-gray-400 text-white hover:bg-gray-500',
                red: 'bg-gradient-to-br from-[#F86187] to-[#E94464] text-white hover:from-[#F86187]/90 hover:to-[#E94464]/90',
                green: 'bg-gradient-to-br from-[#00AA66] to-[#49C55E] text-white hover:from-[#00AA66]/90 hover:to-[#49C55E]/90',
                orange: 'bg-gradient-to-br from-[#FB6D13] to-[#FF9D00] text-white hover:from-[#FB6D13]/90 hover:to-[#FF9D00]/90',
                blue: 'bg-gradient-to-br from-[#298EED] to-[#78BCFD] text-white hover:from-[#298EED]/90 hover:to-[#78BCFD]/90',
                gold: 'bg-gradient-to-br from-[#DFB02F] to-[#ECC438] text-white hover:from-[#DFB02F]/90 hover:to-[#ECC438]/90',
                violet: 'bg-gradient-to-br from-[#DD81FF] to-[#FF0929] text-white hover:from-[#DD81FF]/90 hover:to-[#FF0929]/90',
                aqua: 'bg-gradient-to-br from-[#00B5D7] to-[#0989A2] text-white hover:from-[#00B5D7]/90 hover:to-[#0989A2]/90',
                lightblue: 'bg-gradient-to-br from-[#2F59E5] to-[#44C1F2] text-white hover:from-[#2F59E5]/90 hover:to-[#44C1F2]/90',
                darkviolet: 'bg-gradient-to-br from-[#6441A5] to-[#2a0845] text-white hover:from-[#6441A5]/90 hover:to-[#2a0845]/90',
                starfall: 'bg-gradient-to-br from-[#4b1248] to-[#cc9e54] text-white hover:from-[#4b1248]/90 hover:to-[#cc9e54]/90',
                overworld: 'bg-gradient-to-br from-[#4776e6] to-[#8e54e9] text-white hover:from-[#4776e6]/90 hover:to-[#8e54e9]/90',
                oversky: 'bg-gradient-to-br from-[#3D0DAF] to-[#0998A2] text-white hover:from-[#3D0DAF]/90 hover:to-[#0998A2]/90',
                mojito: 'bg-gradient-to-br from-[#eb3349] to-[#f45c43] text-white hover:from-[#eb3349]/90 hover:to-[#f45c43]/90',
                removeFilter: 'bg-red-500 text-white hover:bg-red-600',
            },
            isSelected: {
                true: 'shadow-lg ring-2 ring-white ring-offset-2 scale-105',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

type ValidHref =
    | AppPathnames
    | {
    pathname: AppPathnames;
    query?: Record<string, any>;
    hash?: string;
};

// Enhanced props with better mobile accessibility
type BaseCategoryCardProps = {
    text: string;
    categoryKey?: string; // Raw key for translations
    image: string;
    isSelected?: boolean;
    className?: string;
    variant?: VariantProps<typeof categoryCardVariants>['variant'];
    id?: string;
    'aria-describedby'?: string;
    alt?: string;
};

export interface CategoryCardButtonProps
    extends BaseCategoryCardProps,
        React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    hrefs?: never;
}

export interface CategoryCardLinkProps
    extends BaseCategoryCardProps,
        Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
    hrefs: ValidHref;
    asChild?: never;
    locale?: string;
}

type CategoryCardProps = CategoryCardButtonProps | CategoryCardLinkProps;

const CategoryCard = React.forwardRef<
    HTMLButtonElement | HTMLAnchorElement,
    CategoryCardProps
>(
    (
        {
            className,
            variant = 'default',
            asChild = false,
            text,
            categoryKey,
            image,
            isSelected,
            hrefs,
            id,
            'aria-describedby': ariaDescribedBy,
            alt,
            ...props
        },
        ref
    ) => {
        const mergedClassName = cn(
            categoryCardVariants({ variant, isSelected, className })
        );
        const tImages = useTranslations('images.categories');

        const content = (
            <>
                {/* Enhanced icon container with better mobile sizing */}
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                    <div className="relative flex items-center justify-center">
                        <Image
                            src={image}
                            alt={tImages(categoryKey || text)}
                            width={32}
                            height={32}
                            className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 transition-all duration-200"
                        />
                    </div>
                </div>
                {/* Responsive text sizing */}
                <span className="text-xs sm:text-sm md:text-base font-medium text-center leading-tight px-1">
                    {text}
                </span>
            </>
        );

        if (hrefs) {
            const {
                asChild: _,
                text: _text,
                categoryKey: _categoryKey,
                image: _image,
                isSelected: _isSelected,
                variant: _variant,
                locale,
                ...linkProps
            } = props as CategoryCardLinkProps;

            return (
                <Link
                    href={hrefs}
                    className={mergedClassName}
                    ref={ref as React.ForwardedRef<HTMLAnchorElement>}
                    locale={locale}
                    id={id}
                    aria-describedby={ariaDescribedBy}
                    {...linkProps}
                >
                    {content}
                </Link>
            );
        }

        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={mergedClassName}
                ref={ref as React.ForwardedRef<HTMLButtonElement>}
                id={id}
                aria-describedby={ariaDescribedBy}
                {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            >
                {content}
            </Comp>
        );
    });

CategoryCard.displayName = 'CategoryCard';

export { CategoryCard, categoryCardVariants };
