'use client';

import { useTranslations } from 'next-intl';
import {
    type InputHTMLAttributes,
    type JSX,
    type ReactNode,
    type TextareaHTMLAttributes,
    useId,
} from 'react';

import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { FieldErrorKey } from '@/lib/add-business/types';
import { cn } from '@/lib/utilities';

/**
 * Pola formularzy flow „Dodaj firme". Blad pola to klucz tlumaczenia z serwera
 * (`addBusiness.errors.*`), podpiety do kontrolki przez `aria-describedby`.
 */

const CONTROL_CLASSES =
    'w-full rounded-md border bg-white px-4 py-3 text-gray-900 dark:bg-gray-700 dark:text-gray-100';

/** Glowny przycisk kroku (styl przycisku formularza kontaktowego). */
export const PRIMARY_BUTTON_CLASSES =
    'w-full rounded-lg bg-orange-500 p-3 font-medium text-white hover:bg-orange-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 dark:bg-orange-600 dark:hover:bg-orange-500 md:w-auto md:px-6';

export function controlClasses(hasError: boolean): string {
    return cn(
        CONTROL_CLASSES,
        hasError ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-600',
    );
}

/** `aria-describedby` z identyfikatorow, ktore faktycznie sa w DOM-ie. */
export function describedBy(...ids: (string | null)[]): string | undefined {
    const present = ids.filter(id => id !== null);
    return present.length > 0 ? present.join(' ') : undefined;
}

interface FieldErrorProps {
    id: string;
    error: FieldErrorKey;
    className?: string;
}

export function FieldError({ id, error, className }: FieldErrorProps): JSX.Element {
    const t = useTranslations();
    return (
        <p id={id} className={cn('text-sm text-red-600 dark:text-red-400', className)}>
            {t(error)}
        </p>
    );
}

interface FieldShellProps {
    id: string;
    label: string;
    hint?: string;
    hintId: string;
    error?: FieldErrorKey;
    errorId: string;
    isRequired?: boolean;
    children: ReactNode;
    footer?: ReactNode;
}

function FieldShell(props: FieldShellProps): JSX.Element {
    const { id, label, hint, hintId, error, errorId, isRequired, children, footer } = props;
    const t = useTranslations('addBusiness.fields');
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="font-medium text-gray-700 dark:text-gray-300">
                {label}
                {isRequired && (
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                        {' '}
                        {t('requiredMark')}
                    </span>
                )}
            </Label>
            {children}
            {hint && (
                <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
                    {hint}
                </p>
            )}
            {footer}
            {error && <FieldError id={errorId} error={error} />}
        </div>
    );
}

interface CommonFieldProps {
    name: string;
    label: string;
    hint?: string;
    error?: FieldErrorKey;
    isRequired?: boolean;
}

type TextFieldProps = CommonFieldProps &
    Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'required'>;

export function TextField(props: TextFieldProps): JSX.Element {
    const { name, label, hint, error, isRequired, className, ...input } = props;
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    return (
        <FieldShell {...{ id, label, hint, hintId, error, errorId, isRequired }}>
            <Input
                id={id}
                name={name}
                aria-required={isRequired || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(hint ? hintId : null, error ? errorId : null)}
                className={cn(controlClasses(Boolean(error)), className)}
                {...input}
            />
        </FieldShell>
    );
}

type TextAreaFieldProps = CommonFieldProps &
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'name' | 'required'> & {
        footer?: ReactNode;
    };

export function TextAreaField(props: TextAreaFieldProps): JSX.Element {
    const { name, label, hint, error, isRequired, footer, className, ...textarea } = props;
    const id = useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    return (
        <FieldShell {...{ id, label, hint, hintId, error, errorId, isRequired, footer }}>
            <Textarea
                id={id}
                name={name}
                aria-required={isRequired || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(hint ? hintId : null, error ? errorId : null)}
                className={cn(controlClasses(Boolean(error)), 'min-h-[120px]', className)}
                {...textarea}
            />
        </FieldShell>
    );
}
