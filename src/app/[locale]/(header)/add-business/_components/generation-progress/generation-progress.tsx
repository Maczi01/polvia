'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type JSX, useEffect, useState } from 'react';

export type ProgressStage = 'reading' | 'classifying' | 'writing';

export const LINK_STAGES: readonly ProgressStage[] = ['reading', 'classifying', 'writing'];
export const MANUAL_STAGES: readonly ProgressStage[] = ['classifying', 'writing'];

/**
 * Generowanie trwa 10–40 s (D6), a akcja nie raportuje postepu — etapy sa orientacyjne
 * i zatrzymuja sie na ostatnim, zamiast udawac, ze praca sie skonczyla.
 */
export const STAGE_DURATION_MS = 8000;

interface GenerationProgressProps {
    isActive: boolean;
    stages: readonly ProgressStage[];
}

/**
 * Region `aria-live` jest w DOM-ie zawsze, a zmienia sie tylko jego tresc — czytnik
 * ekranu ogłasza zmiany w regionie, ktory juz istnial, a nie w nowo wstawionym (R18).
 */
export function GenerationProgress({ isActive, stages }: GenerationProgressProps): JSX.Element {
    const t = useTranslations('addBusiness.progress');
    const [stageIndex, setStageIndex] = useState(0);

    useEffect(() => {
        if (!isActive) return;
        setStageIndex(0);
        const timer = setInterval(() => {
            setStageIndex(index => Math.min(index + 1, stages.length - 1));
        }, STAGE_DURATION_MS);
        return () => clearInterval(timer);
    }, [isActive, stages.length]);

    return (
        <div role="status" aria-live="polite" className="min-h-6 text-sm">
            {isActive && (
                <p className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
                    <span>{t(stages[stageIndex] ?? 'writing')}</span>
                    <span className="text-gray-500 dark:text-gray-400">{t('patience')}</span>
                </p>
            )}
        </div>
    );
}
