import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

import type { PartialService } from '@/types';

type StackedServicesListProps = {
    services: PartialService[];
    onSelect: (service: PartialService) => void;
};

/** Wpisy stojace pod jednym adresem — jedyny sposob, zeby dostac sie do kazdego z nich. */
export const StackedServicesList = ({ services, onSelect }: StackedServicesListProps) => {
    const t = useTranslations('Popup');
    const headingId = useId();

    return (
        // Tlo nadaje komponent, nie Mapbox: globals.css ustawia wszystkim popupom
        // `background-color: transparent` (tak samo robi MarkerPopup).
        <div className="flex max-h-72 w-full flex-col bg-white text-black">
            <p id={headingId} className="py-3 pl-3 pr-12 text-sm font-semibold text-gray-600">
                {t('stackedHeader', { count: services.length })}
            </p>
            <ul aria-labelledby={headingId} className="overflow-y-auto pb-1">
                {services.map(service => (
                    <li key={service.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(service)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                        >
                            <Image
                                src={service.image ? `/services/${service.image}` : '/default.png'}
                                alt=""
                                width={36}
                                height={36}
                                className="size-9 shrink-0 rounded-full border border-gray-200 object-cover"
                            />
                            <span className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-medium">{service.name}</span>
                                {service.city && (
                                    <span className="truncate text-xs text-gray-500">
                                        {service.city}
                                    </span>
                                )}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
