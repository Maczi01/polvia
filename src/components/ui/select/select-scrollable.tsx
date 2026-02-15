import React from 'react';
import { useTranslations } from 'next-intl';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from './select';

interface GroupedOptions {
    [key: string]: {
        tile: string;
        options: string[];
    };
}

interface SingleOption {
    label: React.ReactNode | string;
    value: string;
    translateKey?: string; // Optional key for translation
}

interface SelectScrollableProps {
    options: GroupedOptions | SingleOption[];
    placeholder?: string;
    className?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    showDefault?: boolean;
    translationNamespace?: string;
    defaultOptionTranslateKey?: string;
    translationPrefix?: string;
    ariaLabel?: string;
}

export function SelectScrollable({
    options,
    placeholder = 'Select option',
    className,
    value,
    onValueChange,
    showDefault = true,
    translationNamespace = 'MapPage',
    defaultOptionTranslateKey = 'allVoivodeships',
    translationPrefix = 'counties',
    ariaLabel,
}: SelectScrollableProps) {
    const t = useTranslations(translationNamespace);

    // Helper function to check if options is grouped
    const isGroupedOptions = (options: any): options is GroupedOptions => {
        return (
            typeof options === 'object' &&
            !Array.isArray(options) &&
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            Object.values(options)[0]?.tile !== undefined
        );
    };

    // Function to translate an option
    const translateOption = (option: string | SingleOption): React.ReactNode => {
        // If it's a SingleOption object with a React node as label, return it as is
        if (typeof option !== 'string' && typeof option.label !== 'string') {
            return option.label;
        }

        // Get the translation key
        const translationKey =
            typeof option === 'string'
                ? option.toLowerCase().replace(/\s+/g, '-')
                : option.translateKey || option.value.toLowerCase().replace(/\s+/g, '-');

        // Try to get translation, fall back to original value if not found
        try {
            const translatedValue = t(`${translationPrefix}.${translationKey}`, {
                defaultValue: typeof option === 'string' ? option : String(option.label),
            });
            return translatedValue;
        } catch {
            // If translation fails, return the original value
            return typeof option === 'string' ? option : option.label;
        }
    };

    // Default option handling
    const defaultOptionLabel = showDefault
        ? translateOption({
              value: 'all-voivodeships',
              label: 'Wszystkie województwa',
              translateKey: defaultOptionTranslateKey,
          })
        : null;

    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger
                className={className}
                aria-label={ariaLabel || placeholder}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {showDefault && <SelectItem value="all-voivodeships">{defaultOptionLabel}</SelectItem>}

                {isGroupedOptions(options) ? (
                    Object.entries(options).map(([groupKey, group]) => (
                        <SelectGroup key={groupKey}>
                            <SelectLabel>{translateOption(group.tile)}</SelectLabel>
                            {group.options.map(option => {
                                const isCity = option.startsWith('city:');
                                const displayName = isCity ? option.slice(5) : option;
                                return (
                                    <SelectItem key={option} value={option.toLowerCase()}>
                                        {translateOption(displayName)}
                                    </SelectItem>
                                );
                            })}
                        </SelectGroup>
                    ))
                ) : (
                    <SelectGroup>
                        {(options as SingleOption[]).map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {translateOption(option)}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                )}
            </SelectContent>
        </Select>
    );
}
