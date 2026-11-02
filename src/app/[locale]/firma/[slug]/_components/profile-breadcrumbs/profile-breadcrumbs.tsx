import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import type { ProfileBreadcrumb } from '@/lib/service-profile-breadcrumbs';
import { cn } from '@/lib/utilities';

const breadcrumbsVariants = cva('text-sm', {
    variants: {
        /** `inverted` — jasny tekst na zdjeciu (naglowek szablonu „Galeria”). */
        tone: {
            default: 'text-gray-500 dark:text-gray-400',
            inverted: 'text-white/80 drop-shadow',
        },
    },
    defaultVariants: { tone: 'default' },
});

const linkVariants = cva(
    'rounded-sm underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
    {
        variants: {
            tone: {
                default: 'hover:text-brand',
                inverted: 'hover:text-white',
            },
        },
        defaultVariants: { tone: 'default' },
    },
);

const currentVariants = cva('truncate font-medium', {
    variants: {
        tone: {
            default: 'text-gray-700 dark:text-gray-200',
            inverted: 'text-white',
        },
    },
    defaultVariants: { tone: 'default' },
});

type ProfileBreadcrumbsProps = VariantProps<typeof breadcrumbsVariants> & {
    items: readonly ProfileBreadcrumb[];
    className?: string;
};

type CrumbProps = VariantProps<typeof breadcrumbsVariants> & {
    item: ProfileBreadcrumb;
    isCurrent: boolean;
};

/**
 * Pozycja okruszkow. Zwykly `<a>`, nie `Link` z `@/i18n/navigation`: sciezki mapy
 * z filtrami (`/mapa/zdrowie/warszawa`) nie sa trasami typowanego routingu, a `href` jest
 * juz zlokalizowany (`buildProfileBreadcrumbs`) — dokladnie ten adres trafia do JSON-LD.
 */
function Crumb({ item, isCurrent, tone }: CrumbProps): ReactElement {
    if (isCurrent) {
        return (
            <span aria-current="page" className={currentVariants({ tone })}>
                {item.label}
            </span>
        );
    }
    if (!item.href) return <span>{item.label}</span>;
    return (
        <a href={item.href} className={linkVariants({ tone })}>
            {item.label}
        </a>
    );
}

/**
 * Okruszki nad nazwa firmy: `Polvia › <kategoria> › <miasto> › <nazwa>`. Ostatnia pozycja
 * to biezaca strona (tekst z `aria-current`). Pusta lista — nic.
 */
export function ProfileBreadcrumbs({
    items,
    tone,
    className,
}: ProfileBreadcrumbsProps): ReactElement | null {
    const t = useTranslations('ServiceProfile');
    if (items.length === 0) return null;

    const lastIndex = items.length - 1;
    return (
        <nav aria-label={t('breadcrumbs')} className={cn(breadcrumbsVariants({ tone }), className)}>
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                {items.map((item, index) => (
                    <li
                        key={`${index}-${item.label}`}
                        className="flex min-w-0 items-center gap-1.5"
                    >
                        {index > 0 && (
                            <ChevronRight
                                size={14}
                                aria-hidden="true"
                                className="shrink-0 opacity-60"
                            />
                        )}
                        <Crumb item={item} isCurrent={index === lastIndex} tone={tone} />
                    </li>
                ))}
            </ol>
        </nav>
    );
}
