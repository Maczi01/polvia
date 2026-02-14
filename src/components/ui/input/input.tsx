import Image from 'next/image'
import * as React from 'react'
import { X } from 'lucide-react'           // <-- using 'X' icon from lucide-react
import { cn } from '@/lib/utilities'
import { Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    /** If true, shows a search icon on the left. */
    icon?: boolean
    loupe?: boolean
    /** If true, shows an "X" icon to clear the input on the right. */
    clearable?: boolean
    onClear?: () => void
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className,
         type,
         icon,
         loupe,
         clearable, value,
         onChange,
         onClear, ...props }, ref) => {
        /** Clears the parent's value by calling `onChange` with an empty string. */
        const handleClear = React.useCallback(() => {
            if (onChange) {
                // Create a synthetic event to keep consistent with typical onChange usage
                const clearedEvent = {
                    target: { value: '' },
                } as React.ChangeEvent<HTMLInputElement>
                onChange(clearedEvent)
                if (onClear) {
                    onClear();
                }
            }
        }, [onChange])

        // If the icon prop is set, render a search icon on the left + extra left padding.
        if (icon) {
            return (
                <div className="relative">
                    {/* Left search icon */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Image
                            src="/icons/loupe.svg"
                            alt="Search icon"
                            width={16}
                            height={16}
                            className="text-muted-foreground dark:brightness-0 dark:invert"
                        />
                    </div>

                    <input
                        ref={ref}
                        type={type}
                        value={value}
                        onChange={onChange}
                        className={cn(
                            'flex h-9 w-full rounded-full border border-input bg-white dark:bg-gray-800 pl-9 pr-8 py-1 ' +
                            'text-base text-gray-900 dark:text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm ' +
                            'file:font-medium file:text-foreground placeholder:text-gray-500 dark:placeholder:text-gray-300 focus-visible:outline-none ' +
                            'focus-visible:ring-1 focus-visible:ring-ring focus:bg-gray-100 dark:focus:bg-gray-700 disabled:cursor-not-allowed ' +
                            'disabled:opacity-50 md:text-sm',
                            className
                        )}
                        {...props}
                    />

                    {/* Show the Lucide "X" icon if clearable and there's a non-empty value */}
                    {clearable && value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                        >
                            <X size={16} className="text-gray-500 dark:text-gray-400" />
                        </button>
                    )}
                </div>
            )
        }

        else if(loupe) {
            return (
                <div className="relative">
                    {/* Left search icon */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Search size="20" color="#22c55e" className="dark:text-green-400" />
                    </div>

                    <input
                        ref={ref}
                        type={type}
                        value={value}
                        onChange={onChange}
                        className={cn(
                            'flex h-9 w-full rounded-full border border-input bg-white dark:bg-gray-800 pl-9 pr-8 py-1 ' +
                            'text-base text-gray-900 dark:text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm ' +
                            'file:font-medium file:text-foreground placeholder:text-gray-500 dark:placeholder:text-gray-300 focus-visible:outline-none ' +
                            'focus-visible:ring-1 focus-visible:ring-ring focus:bg-gray-100 dark:focus:bg-gray-700 disabled:cursor-not-allowed ' +
                            'disabled:opacity-50 md:text-sm',
                            className
                        )}
                        {...props}
                    />

                    {/* Show the Lucide "X" icon if clearable and there's a non-empty value */}
                    {clearable && value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                        >
                            <X size={16} className="text-gray-500 dark:text-gray-400" />
                        </button>
                    )}
                </div>
            )
        }

        // The "plain" version without the left icon
        return (
            <div className="relative">
                <input
                    ref={ref}
                    type={type}
                    value={value}
                    onChange={onChange}
                    className={cn(
                        'flex h-9 w-full rounded-md border border-input bg-white dark:bg-gray-800 px-3 py-1 ' +
                        'text-base text-gray-900 dark:text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm ' +
                        'file:font-medium file:text-foreground placeholder:text-gray-500 dark:placeholder:text-gray-300 ' +
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ' +
                        'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                        className
                    )}
                    {...props}
                />

                {clearable && value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                        <X size={16} className="text-gray-500 dark:text-gray-400" />
                    </button>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

export { Input }