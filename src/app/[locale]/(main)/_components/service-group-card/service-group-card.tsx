'use client';

import { ChevronDown, MapPin } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, type ReactElement } from 'react';

import { Badge } from '@/components/ui/badge/badge';
import { Card } from '@/components/ui/card';
import { mapCategoryToBadgeColor } from '@/lib/consts';
import { cn } from '@/lib/utilities';
import type { PartialService } from '@/types';

interface ServiceGroupCardProps {
    name: string;
    /** Lokalizacje, ktore przeszly filtr — nie wszystkie, jakie firma ma. */
    services: PartialService[];
    cities: string[];
    isExpanded: boolean;
    onToggle: () => void;
    /** Zwinieta grupa odpowiada N pinom, wiec hover oddaje komplet id. */
    onHover: (serviceIds: string[] | null) => void;
}

/**
 * Naglowek firmy wielooddzialowej w liscie przy mapie.
 *
 * Uklad odwzorowuje naglowek `service-card.tsx` CELOWO i co do klasy: logo 56 px,
 * nazwa `text-base font-bold md:text-lg`, tagi w osobnym rzedzie POD kolumna
 * logo+tekst (a nie w niej), zeby ich lewa krawedz stala rowno z logo.
 *
 * Poprzednia wersja miala wlasne `px-4 py-3` DOKLADANE do `p-2 md:p-4` z `Card`,
 * przez co logo bylo wciete i opuszczone wzgledem sasiednich kart, a nazwa byla
 * mniejsza. Firma z wieloma punktami wygladala przez to slabiej niz jednopunktowa.
 */
export function ServiceGroupCard({
    name,
    services,
    cities,
    isExpanded,
    onToggle,
    onHover,
}: ServiceGroupCardProps): ReactElement {
    const t = useTranslations('MapList');

    const serviceIds = services.map(service => service.id);

    const handleMouseEnter = useCallback(() => onHover(serviceIds), [onHover, serviceIds]);
    const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

    // Logo, tagi i kategoria sa cechami FIRMY, nie oddzialu, wiec kazdy czlonek
    // grupy niesie te same wartosci. `find` zamiast `services[0]`: gdyby akurat
    // pierwsza lokalizacja miala puste pole, karta zgubilaby je mimo ze firma je ma.
    const logo = services.find(service => service.image)?.image;
    const logoSrc = logo ? `/services/${logo.trimEnd()}` : '/default.png';
    const tags = services.find(service => service.tags?.length)?.tags ?? [];
    const badgeColor = mapCategoryToBadgeColor(services[0]?.category ?? '');

    return (
        <Card
            className={cn(
                'mb-2 bg-white transition-all duration-300 ease-in-out md:mb-4',
                'cursor-pointer border-gray-200 hover:border-green-500/30 hover:bg-green-50/30',
                'dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-400/30 dark:hover:bg-green-900/10',
                isExpanded && 'mb-0 md:mb-2',
            )}
        >
            <button
                type="button"
                onClick={onToggle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
                aria-expanded={isExpanded}
                className="relative w-full p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-0"
            >
                <span className="flex items-start gap-3">
                    <span className="shrink-0">
                        <Image
                            src={logoSrc}
                            alt=""
                            width={56}
                            height={56}
                            className="overflow-hidden rounded-full border-2 border-gray-200 object-cover dark:border-gray-600"
                        />
                    </span>

                    <span className="min-w-0 flex-1 pr-10">
                        <span className="flex items-center gap-2">
                            <span className="truncate text-base font-bold text-gray-900 dark:text-gray-100 md:text-lg">
                                {name}
                            </span>
                            <Badge variant="lightblue" className="shrink-0">
                                {t('multi_location')}
                            </Badge>
                        </span>

                        <span className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <MapPin size={14} className="shrink-0" />
                            {/*
                             * Liczby pochodza z `services` i `cities`, czyli z lokalizacji
                             * PO filtrowaniu. Licznik opisuje to, co uzytkownik zobaczy po
                             * rozwinieciu, a nie ile firma ma punktow w calej Polsce.
                             */}
                            {t('group_locations', {
                                locations: services.length,
                                cities: cities.length,
                            })}
                        </span>
                    </span>

                    <ChevronDown
                        size={22}
                        className={cn(
                            'absolute right-1 top-1 shrink-0 text-gray-400 transition-transform duration-300 md:right-0 md:top-0',
                            isExpanded && 'rotate-180',
                        )}
                    />
                </span>

                {/*
                 * Tagi POZA rzedem logo+tekst, tak samo jak w `service-card.tsx` —
                 * dzieki temu ich lewa krawedz stoi rowno z logo, a nie z nazwa.
                 */}
                {tags.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                        {tags.slice(0, 3).map((tag, index) => (
                            <Badge
                                key={index}
                                label={tag?.toString() || ''}
                                color="gray"
                                variant={badgeColor}
                            />
                        ))}
                    </span>
                )}
            </button>
        </Card>
    );
}
