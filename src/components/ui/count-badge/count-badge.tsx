import * as React from 'react';
import { cn } from '@/lib/utilities';

interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    count: number;
}

/** Licznik w czarnym okregu — ten sam na pinie klastra mapy i na przyciskach kategorii. */
export function CountBadge({ count, className, ...props }: CountBadgeProps): React.JSX.Element {
    return (
        <span
            className={cn(
                'inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-gray-300 bg-black px-1 text-sm font-bold tabular-nums leading-none text-white',
                className,
            )}
            {...props}
        >
            {count}
        </span>
    );
}
