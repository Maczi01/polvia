'use client';

import { TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { JSX, ReactNode } from 'react';

import type { DraftPin } from '@/lib/add-business/types';
import type { Coverage } from '@/lib/coverage';

import { STATIC_MAP_HEIGHT, STATIC_MAP_WIDTH, staticMapUrl } from './static-map-url';

const ATTRIBUTION_LINK_CLASSES =
    'underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600';

const WARNING_CLASSES =
    'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100';

/** Ostrzezenie o pinezce (brak, przyblizona) — w karcie i pod mapa edytora. */
export function MapWarning({ children }: { children: ReactNode }): JSX.Element {
    return (
        <p className={WARNING_CLASSES}>
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {children}
        </p>
    );
}

interface StaticMapPinProps {
    pin: DraftPin | null;
    coverage: Coverage;
    address: string;
}

/**
 * Pin podgladu jako statyczny obraz (D10). Atrybucja Mapbox/OSM jest wymagana przez obu
 * dostawcow; Nominatim (geokoder) to tez dane OSM, wiec podpisujemy i jego.
 *
 * `unoptimized`: obraz idzie z Mapboxa prosto do przegladarki. `next.config.ts` nie ma
 * `images.remotePatterns`, a optymalizator Next nie powinien posredniczyc w obcych obrazach.
 */
export function StaticMapPin({ pin, coverage, address }: StaticMapPinProps): JSX.Element | null {
    const t = useTranslations('addBusiness.preview');

    // Wpis `online` nie ma punktu obslugi, wiec i pinu (CLAUDE.md: zasieg to druga os).
    if (coverage === 'online') return null;

    if (pin === null) {
        return <MapWarning>{t('noPin')}</MapWarning>;
    }

    return (
        <figure className="space-y-2">
            <Image
                src={staticMapUrl(pin)}
                alt={address ? t('mapAlt', { address }) : t('mapAltNoAddress')}
                width={STATIC_MAP_WIDTH}
                height={STATIC_MAP_HEIGHT}
                unoptimized
                className="h-auto w-full rounded-lg border border-gray-200 dark:border-gray-700"
            />
            {pin.approximate && <MapWarning>{t('approximatePin')}</MapWarning>}
            <figcaption className="text-xs text-gray-500 dark:text-gray-400">
                <a
                    href="https://www.mapbox.com/about/maps/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ATTRIBUTION_LINK_CLASSES}
                >
                    © Mapbox
                </a>{' '}
                <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ATTRIBUTION_LINK_CLASSES}
                >
                    © OpenStreetMap
                </a>{' '}
                · {t('geocodingAttribution')}
            </figcaption>
        </figure>
    );
}
