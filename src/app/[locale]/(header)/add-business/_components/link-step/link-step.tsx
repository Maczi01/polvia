'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, type JSX, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import type { ActionErrorCode, FieldErrorKey, FieldErrors } from '@/lib/add-business/types';

import { ActionErrorNotice } from '../flow-notices/flow-notices';
import { FlowHeading } from '../flow-heading/flow-heading';
import { PRIMARY_BUTTON_CLASSES, TextField } from '../form-field/form-field';
import { GenerationProgress, LINK_STAGES } from '../generation-progress/generation-progress';

const REQUIRED: FieldErrorKey = 'addBusiness.errors.required';
const INVALID_URL: FieldErrorKey = 'addBusiness.errors.invalidUrl';

export type LinkCheck = { ok: true; url: string } | { ok: false; error: FieldErrorKey };

/**
 * Wstepna kontrola linku przed akcja: pusty albo niepoprawny link nie zuzywa zapytania
 * do serwera. Wlasciciele wklejaja domene bez schematu (`twojafirma.pl`), wiec brak
 * schematu uzupelniamy `https://`. Decyzja nalezy i tak do serwera (`classifyLink`).
 */
export function checkLink(raw: string): LinkCheck {
    const value = raw.trim();
    if (value === '') return { ok: false, error: REQUIRED };

    // `mailto:` czy `javascript:` to schemat bez `//`; `firma.pl:8080` to host z portem.
    const hasScheme = /^[a-z][a-z\d+-]*:/i.test(value);
    if (hasScheme && !value.includes('://')) return { ok: false, error: INVALID_URL };

    const url = parseUrl(hasScheme ? value : `https://${value}`);
    if (url === null) return { ok: false, error: INVALID_URL };

    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    if (!isHttp || !url.hostname.includes('.')) return { ok: false, error: INVALID_URL };

    return { ok: true, url: hasScheme ? value : `https://${value}` };
}

/**
 * `URL.canParse` nie istnieje w Safari < 17 ani w jsdom, wiec zostaje konstruktor.
 * Konstruktor z jednym napisem rzuca wylacznie `TypeError` „Invalid URL" (spec WHATWG),
 * czyli odpowiedz „to nie jest URL", a nie blad do zalogowania. `instanceof` nie wchodzi
 * w gre: w jsdom wyjatek pochodzi z innego realmu.
 */
function parseUrl(value: string): URL | null {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}

interface LinkStepProps {
    fieldErrors: FieldErrors;
    error: ActionErrorCode | null;
    isPending: boolean;
    onGenerate: (formData: FormData) => void;
    onManual: () => void;
    shouldFocusHeading?: boolean;
}

export function LinkStep(props: LinkStepProps): JSX.Element {
    const { fieldErrors, error, isPending, onGenerate, onManual, shouldFocusHeading } = props;
    const t = useTranslations('addBusiness.link');
    const [clientError, setClientError] = useState<FieldErrorKey | null>(null);

    function handleSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (isPending) return;

        const raw = new FormData(event.currentTarget).get('url');
        const check = checkLink(typeof raw === 'string' ? raw : '');
        if (!check.ok) {
            setClientError(check.error);
            return;
        }

        setClientError(null);
        const formData = new FormData();
        formData.set('mode', 'link');
        formData.set('url', check.url);
        onGenerate(formData);
    }

    return (
        <section aria-labelledby="add-business-link-heading" className="space-y-6">
            <FlowHeading id="add-business-link-heading" shouldFocusOnMount={shouldFocusHeading}>
                {t('heading')}
            </FlowHeading>

            {error && <ActionErrorNotice code={error} />}

            <form noValidate onSubmit={handleSubmit} className="space-y-4">
                <TextField
                    name="url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    label={t('label')}
                    hint={t('hint')}
                    placeholder={t('placeholder')}
                    error={clientError ?? fieldErrors.url}
                    isRequired
                    readOnly={isPending}
                />

                {/* `aria-disabled` zamiast `disabled`: wylaczony przycisk gubi fokus. */}
                <Button type="submit" aria-disabled={isPending} className={PRIMARY_BUTTON_CLASSES}>
                    {isPending ? t('generating') : t('submit')}
                </Button>

                <GenerationProgress isActive={isPending} stages={LINK_STAGES} />
            </form>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 text-sm dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-300">{t('manualPrompt')}</span>
                <Button
                    type="button"
                    variant="link"
                    onClick={onManual}
                    disabled={isPending}
                    className="h-auto p-0 text-green-700 dark:text-green-400"
                >
                    {t('manualButton')}
                </Button>
            </div>
        </section>
    );
}
