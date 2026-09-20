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

    // Logo jest cecha FIRMY, nie oddzialu, wiec dowolny czlonek grupy je niesie.
    // Ta sama konstrukcja sciezki i ten sam fallback co w `service-card.tsx` —
    // zwinieta grupa stoi w liscie obok zwyklych kart i ma wygladac jak one.
    const logo = services.find(service => service.image)?.image;
    const logoSrc = logo ? `/services/${logo.trimEnd()}` : '/default.png';

    // Nazwa, opis, tagi i kategoria sa cechami FIRMY — kazdy czlonek grupy niesie
    // te same wartosci, wiec bierzemy je z pierwszego, ktory je ma.
    const tags = services.find(service => service.tags?.length)?.tags ?? [];
    const badgeColor = mapCategoryToBadgeColor(services[0]?.category ?? '');

    const handleMouseEnter = useCallback(() => onHover(serviceIds), [onHover, serviceIds]);
    const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

    return (
        <Card
            className={cn(
                'mb-2 overflow-hidden border-gray-200 bg-white transition-colors md:mb-4',
                'dark:border-gray-700 dark:bg-gray-800',
                isExpanded && 'border-b-0 md:mb-0',
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
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-green-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-green-900/10"
            >
                <Image
                    src={logoSrc}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 shrink-0 overflow-hidden rounded-full border-2 border-gray-200 object-cover dark:border-gray-600"
                />

                <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900 dark:text-gray-100">
                        {name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
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
                </span>

                <ChevronDown
                    size={20}
                    className={cn(
                        'shrink-0 text-gray-400 transition-transform duration-200',
                        isExpanded && 'rotate-180',
                    )}
                />
            </button>
        </Card>
    );
}
