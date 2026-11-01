import type { ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utilities';

type ProfileSectionProps = {
    /** Kotwica sekcji; naglowek dostaje `${id}-heading`. Jedna sekcja danego typu na strone. */
    id: string;
    title: string;
    children: ReactNode;
    className?: string;
    titleClassName?: string;
};

/** Sekcja profilu: `section` nazwana swoim `h2`. Szablony nadpisuja ramke przez `className`. */
export function ProfileSection({
    id,
    title,
    children,
    className,
    titleClassName,
}: ProfileSectionProps): ReactElement {
    const headingId = `${id}-heading`;

    return (
        <section
            id={id}
            aria-labelledby={headingId}
            className={cn(
                'rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 md:p-6',
                className,
            )}
        >
            <h2
                id={headingId}
                className={cn(
                    'text-lg font-semibold text-gray-900 dark:text-gray-100 md:text-xl',
                    titleClassName,
                )}
            >
                {title}
            </h2>
            <div className="mt-4">{children}</div>
        </section>
    );
}
