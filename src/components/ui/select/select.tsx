'use client';

import {
    Root as SelectPrimitiveRoot,
    Group as SelectPrimitiveGroup,
    Value as SelectPrimitiveValue,
    Trigger as SelectPrimitiveTrigger,
    Icon as SelectPrimitiveIcon,
    ScrollUpButton as SelectPrimitiveScrollUpButton,
    ScrollDownButton as SelectPrimitiveScrollDownButton,
    Portal as SelectPrimitivePortal,
    Content as SelectPrimitiveContent,
    Viewport as SelectPrimitiveViewport,
    Label as SelectPrimitiveLabel,
    Item as SelectPrimitiveItem,
    ItemIndicator as SelectPrimitiveItemIndicator,
    ItemText as SelectPrimitiveItemText,
    Separator as SelectPrimitiveSeparator,
} from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utilities';

// Reusable constants
const ICON_SIZE = 'h-4 w-4';
const SCROLL_BUTTON_CLASSES = 'flex cursor-default items-center justify-center py-1';
const ITEM_INDICATOR_CLASSES = 'absolute right-2 flex h-3.5 w-3.5 items-center justify-center';

// Component exports
const Select = SelectPrimitiveRoot;
const SelectGroup = SelectPrimitiveGroup;
const SelectValue = SelectPrimitiveValue;

// Select Trigger
const triggerBaseClasses = cn(
    'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-full',
    'border border-input bg-white dark:bg-gray-800 px-3 py-2 text-md md:text-sm',
    'shadow-sm ring-offset-background placeholder:text-muted-foreground',
    'focus:outline-none focus:ring-1 focus:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    '[&>span]:line-clamp-1'
);

const SelectTrigger = React.forwardRef<
    React.ElementRef<typeof SelectPrimitiveTrigger>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitiveTrigger>
>(({ className, children, ...props }, ref) => (
    <SelectPrimitiveTrigger
        ref={ref}
        className={cn(triggerBaseClasses, className)}
        {...props}
    >
        {children}
        <SelectPrimitiveIcon asChild>
            <ChevronDown className={cn(ICON_SIZE, 'opacity-50')} />
        </SelectPrimitiveIcon>
    </SelectPrimitiveTrigger>
));
SelectTrigger.displayName = SelectPrimitiveTrigger.displayName;

// Scroll Buttons
const SelectScrollUpButton = React.forwardRef<
    React.ElementRef<typeof SelectPrimitiveScrollUpButton>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitiveScrollUpButton>
>(({ className, ...props }, ref) => (
    <SelectPrimitiveScrollUpButton
        ref={ref}
        className={cn(SCROLL_BUTTON_CLASSES, className)}
        {...props}
    >
        <ChevronUp className={ICON_SIZE} />
    </SelectPrimitiveScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitiveScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
    React.ElementRef<typeof SelectPrimitiveScrollDownButton>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitiveScrollDownButton>
>(({ className, ...props }, ref) => (
    <SelectPrimitiveScrollDownButton
        ref={ref}
        className={cn(SCROLL_BUTTON_CLASSES, className)}
        {...props}
    >
        <ChevronDown className={ICON_SIZE} />
    </SelectPrimitiveScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitiveScrollDownButton.displayName;

// Select Content
const contentBaseClasses = cn(
    'relative z-[105] max-h-96 min-w-[8rem] overflow-hidden rounded-md border',
    'bg-popover text-popover-foreground shadow-md',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
    'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
);

const popperClasses = cn(
    'data-[side=bottom]:translate-y-1',
    'data-[side=left]:-translate-x-1',
    'data-[side=right]:translate-x-1',
    'data-[side=top]:-translate-y-1'
);

const SelectContent = React.forwardRef<
    React.ElementRef<typeof SelectPrimitiveContent>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitiveContent>
>(({ className, children, position = 'popper', ...props }, ref) => (
    <SelectPrimitivePortal>
        <SelectPrimitiveContent
            ref={ref}
            className={cn(
                contentBaseClasses,
                position === 'popper' && popperClasses,
                className
            )}
            position={position}
            {...props}
        >
            <SelectScrollUpButton />
            <SelectPrimitiveViewport
                className={cn(
                    'p-1',
                    position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
                )}
            >
                {children}
            </SelectPrimitiveViewport>
            <SelectScrollDownButton />
        </SelectPrimitiveContent>
    </SelectPrimitivePortal>
));
SelectContent.displayName = SelectPrimitiveContent.displayName;

// Select Label
const SelectLabel = React.forwardRef<
    React.ElementRef<typeof SelectPrimitiveLabel>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitiveLabel>
>(({ className, ...props }, ref) => (
    <SelectPrimitiveLabel
        ref={ref}
        className={cn('px-2 py-1.5 flex items-center text-sm font-semibold', className)}
        {...props}
    />
));
SelectLabel.displayName = SelectPrimitiveLabel.displayName;

// Select Item
const itemBaseClasses = cn(
    'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8',
    'text-sm outline-none focus:bg-accent focus:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
);

const SelectItem = React.forwardRef<
    React.ElementRef<typeof SelectPrimitiveItem>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitiveItem>
>(({ className, children, ...props }, ref) => (
    <SelectPrimitiveItem
        ref={ref}
        className={cn(itemBaseClasses, className)}
        {...props}
    >
    <span className={ITEM_INDICATOR_CLASSES}>
      <SelectPrimitiveItemIndicator>
        <Check className={ICON_SIZE} />
      </SelectPrimitiveItemIndicator>
    </span>
        <SelectPrimitiveItemText>{children}</SelectPrimitiveItemText>
    </SelectPrimitiveItem>
));
SelectItem.displayName = SelectPrimitiveItem.displayName;

// Select Separator
const SelectSeparator = React.forwardRef<
    React.ElementRef<typeof SelectPrimitiveSeparator>,
    React.ComponentPropsWithoutRef<typeof SelectPrimitiveSeparator>
>(({ className, ...props }, ref) => (
    <SelectPrimitiveSeparator
        ref={ref}
        className={cn('-mx-1 my-1 h-px bg-muted', className)}
        {...props}
    />
));
SelectSeparator.displayName = SelectPrimitiveSeparator.displayName;

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
};