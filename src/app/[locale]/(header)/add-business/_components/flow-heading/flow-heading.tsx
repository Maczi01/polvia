'use client';

import { type HTMLAttributes, type JSX, useEffect, useRef } from 'react';

import { cn } from '@/lib/utilities';

interface FlowHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
    /** Przeniesienie fokusu przy wejsciu na ekran — czytnik ogłasza nowy krok. */
    shouldFocusOnMount?: boolean;
}

/**
 * Naglowek kroku flow. Krok zmienia sie bez nawigacji, wiec bez przeniesienia fokusu
 * czytnik ekranu nie wie, ze tresc strony sie zmienila (R18). Pierwszy krok nie
 * przejmuje fokusu, zeby nie przeskakiwac przy wejsciu na strone.
 */
export function FlowHeading({
    shouldFocusOnMount = false,
    className,
    children,
    ...props
}: FlowHeadingProps): JSX.Element {
    const ref = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (shouldFocusOnMount) ref.current?.focus();
    }, [shouldFocusOnMount]);

    return (
        <h2
            ref={ref}
            tabIndex={-1}
            className={cn(
                'text-2xl font-semibold text-gray-900 focus:outline-none dark:text-gray-100',
                className,
            )}
            {...props}
        >
            {children}
        </h2>
    );
}
