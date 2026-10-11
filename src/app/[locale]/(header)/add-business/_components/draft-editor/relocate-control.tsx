'use client';

import { MapPinned } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

import { Button } from '@/components/ui/button/button';
import type { RelocateResult } from '@/lib/add-business/types';

interface RelocateControlProps {
    isAddressChanged: boolean;
    isRelocating: boolean;
    result: RelocateResult | null;
    onRelocate: () => void;
}

/**
 * „Sprawdz na mapie" (R8): aktywny dopiero, gdy wpisany adres rozni sie od tego na mapie.
 * Wynik trafia do regionu `aria-live` obecnego w DOM-ie od poczatku (R18).
 */
export function RelocateControl(props: RelocateControlProps): JSX.Element {
    const { isAddressChanged, isRelocating, result, onRelocate } = props;
    const t = useTranslations('addBusiness');
    const isBlocked = !isAddressChanged || isRelocating;

    return (
        <div className="space-y-2 md:col-span-2">
            <Button
                type="button"
                variant="outline"
                onClick={isBlocked ? undefined : onRelocate}
                aria-disabled={isBlocked}
                className="border px-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
                <MapPinned aria-hidden />
                {isRelocating ? t('editor.checkingOnMap') : t('editor.checkOnMap')}
            </Button>
            {isAddressChanged && !isRelocating && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('editor.addressChanged')}
                </p>
            )}
            <p
                role="status"
                aria-live="polite"
                className="text-sm text-gray-700 dark:text-gray-300"
            >
                {result?.status === 'relocated' &&
                    t('editor.relocated', { count: result.remainingRelocations })}
                {result?.status === 'error' && t(`actionErrors.${result.error.code}`)}
            </p>
        </div>
    );
}
