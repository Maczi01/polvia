'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type MouseEvent, type ReactElement, useCallback, useEffect, useState } from 'react';

/**
 * Stan jako unia, nie dwa boole (`isCopied` + `hasFailed`): kombinacja
 * "skopiowane ORAZ blad" nie istnieje, wiec nie ma po co jej reprezentowac.
 */
type CopyStatus = 'idle' | 'copied' | 'error';

/** Po tylu ms komunikat znika i przycisk wraca do ikony kopiowania. */
const STATUS_RESET_MS = 2000;

interface CopyEmailButtonProps {
    email: string;
}

export function CopyEmailButton({ email }: CopyEmailButtonProps): ReactElement {
    const t = useTranslations('MapCard');
    const [status, setStatus] = useState<CopyStatus>('idle');

    useEffect(() => {
        if (status === 'idle') return;

        const timer = setTimeout(() => setStatus('idle'), STATUS_RESET_MS);
        return () => clearTimeout(timer);
    }, [status]);

    const handleCopy = useCallback(
        async (event: MouseEvent<HTMLButtonElement>) => {
            // Przycisk siedzi w karcie, ktora na klik rozwija sie i leci do pinu.
            // Bez tego kopiowanie adresu przestawialoby mape.
            event.stopPropagation();

            // `navigator.clipboard` nie istnieje poza bezpiecznym kontekstem
            // (czyste HTTP inne niz localhost) i moze byc zablokowane polityka
            // uprawnien. To nie jest hipotetyczny scenariusz, wiec uzytkownik
            // dostaje informacje zamiast przycisku, ktory po cichu nic nie robi.
            try {
                await navigator.clipboard.writeText(email);
                setStatus('copied');
            } catch {
                setStatus('error');
            }
        },
        [email],
    );

    const message = status === 'copied' ? t('emailCopied') : status === 'error' ? t('emailCopyFailed') : '';

    return (
        <>
            <button
                type="button"
                onClick={handleCopy}
                aria-label={t('copyEmail')}
                className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
                {status === 'copied' ? (
                    <Check size={14} className="text-green-600 dark:text-green-400" />
                ) : (
                    <Copy size={14} />
                )}
            </button>

            {/* Region musi istniec w DOM-ie ZANIM pojawi sie tresc — dopiero
                wtedy czytnik ekranu ja ogloszy. Stad pusty span, nie warunek. */}
            <span
                role="status"
                aria-live="polite"
                className={
                    status === 'error'
                        ? 'text-xs text-red-600 dark:text-red-400'
                        : 'text-xs text-green-700 dark:text-green-400'
                }
            >
                {message}
            </span>
        </>
    );
}
