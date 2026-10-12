'use client';

import { RotateCcw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { type JSX, useId, useRef } from 'react';

import { Button } from '@/components/ui/button/button';
import type { FieldErrorKey } from '@/lib/add-business/types';

import { describedBy, FieldError } from '../form-field/form-field';
import { RelocateControl } from './relocate-control';
import type { PinPicker as PinPickerState } from './use-pin-picker';

/** Wspolrzedne `pinLat`/`pinLng` — ~10 cm, bez notacji wykladniczej (`pinSchema`). */
const COORDINATE_DECIMALS = 6;

function MapLoading(): JSX.Element {
    const t = useTranslations('addBusiness.pinMap');
    return (
        <div className="flex size-full items-center justify-center bg-gray-100 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {t('loading')}
        </div>
    );
}

const loadPinMap = (): Promise<typeof import('./pin-map')> => import('./pin-map');

const PinMap = dynamic(() => loadPinMap().then(module => module.PinMap), {
    ssr: false,
    loading: MapLoading,
});

/**
 * Pobiera chunk mapy (mapbox-gl) w tle — wolane na starcie generowania, ktore trwa
 * 10–40 s, wiec w edytorze mapa jest juz gotowa zamiast „Laduje mape…".
 */
export function preloadPinMap(): void {
    loadPinMap().catch((error: unknown) => {
        console.error('add-business pin map preload failed', error);
    });
}

interface PinPickerProps {
    picker: PinPickerState;
    isAddressChanged: boolean;
    error: FieldErrorKey | undefined;
    onSearch: () => void;
}

/**
 * Mapa z wyszukiwaniem i przesuwana pinezka (C). Alternatywa klawiaturowa to samo
 * wyszukiwanie po adresie — wystarcza do ustawienia pinezki bez myszy. `pinLat`/`pinLng`
 * wypelnia wylacznie klik albo przeciagniecie; po samym wyszukaniu zostaja puste.
 */
export function PinPicker({
    picker,
    isAddressChanged,
    error,
    onSearch,
}: PinPickerProps): JSX.Element {
    const t = useTranslations('addBusiness');
    const baseId = useId();
    const hintId = `${baseId}-hint`;
    const errorId = `${baseId}-error`;
    const mapRef = useRef<HTMLDivElement>(null);
    const { relocation, manualPin } = picker;

    function handleReset(): void {
        picker.reset();
        // Przycisk znika razem z reczna pinezka — fokus wraca na mape, nie na <body>.
        mapRef.current?.focus();
    }

    return (
        <div className="space-y-3">
            <RelocateControl
                isAddressChanged={isAddressChanged}
                isRelocating={relocation.isRelocating}
                result={relocation.result}
                onRelocate={onSearch}
            />
            <p id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
                {t('pinMap.hint')}
            </p>
            <div
                ref={mapRef}
                role="group"
                tabIndex={-1}
                aria-label={t('pinMap.label')}
                aria-describedby={describedBy(hintId, error ? errorId : null)}
                className="h-72 overflow-hidden rounded-lg border border-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 dark:border-gray-700"
            >
                <PinMap pin={picker.pin} focus={relocation.pin} onPick={picker.pick} />
            </div>
            <input
                type="hidden"
                name="pinLat"
                value={manualPin?.lat.toFixed(COORDINATE_DECIMALS) ?? ''}
            />
            <input
                type="hidden"
                name="pinLng"
                value={manualPin?.lng.toFixed(COORDINATE_DECIMALS) ?? ''}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p
                    role="status"
                    aria-live="polite"
                    className="text-sm text-gray-700 dark:text-gray-300"
                >
                    {picker.isOutsidePoland
                        ? t('errors.pinOutsidePoland')
                        : manualPin !== null && t('pinMap.manual')}
                </p>
                {manualPin !== null && (
                    <Button
                        type="button"
                        variant="link"
                        onClick={handleReset}
                        className="h-auto p-0 text-green-700 dark:text-green-400"
                    >
                        <RotateCcw aria-hidden />
                        {t('pinMap.reset')}
                    </Button>
                )}
            </div>
            {error && <FieldError id={errorId} error={error} />}
        </div>
    );
}
