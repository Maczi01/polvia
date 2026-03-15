import Link from 'next/link';
import React from 'react';
import { Popup } from 'react-map-gl/mapbox';
import Image from 'next/image';
import { cn } from '@/lib/utilities';
import { PartialService } from '@/types';
import { useTranslations } from 'next-intl';

type MarkerPopupProps = {
    latitude: number;
    name: string;
    image: string;
    place: string;
    longitude: number;
    onClose: () => void;
    category: string;
    isMobile: boolean;
    selectedService: PartialService | null;
};

export const MarkerPopup = ({
    onClose,
    isMobile,
    selectedService,
}: MarkerPopupProps) => {
    const t = useTranslations('Popup'); // Retaining your translation namespace
    if (isMobile || !selectedService) return null;

    const image = selectedService ? `/services/${selectedService.image}` : '/default.png';

    return (
        <Popup
            longitude={selectedService.longitude}
            latitude={selectedService.latitude}
            closeOnClick={false}
            onClose={onClose}
            focusAfterOpen={false}
        >
            <>
                <div
                    className="min-h-68 z-50 flex flex-col
             rounded-t-lg bg-white text-black shadow-md
            "
                >
                    <div
                        className="min-h-24 flex items-center
            p-2 rounded-xl
            {/*hover:bg-gray-100*/}
            {/*hover:border-2*/}
             transition
 p-10
            duration-300 ease-in-out hover:cursor-pointer"
                    >
                        <Image
                            src={image}
                            alt="service image"
                            className="overflow-hidden rounded-full
                        border-2 border-gray-300 object-cover"
                            width={68}
                            height={68}
                        />

                        <div className="flex grow flex-col justify-center px-3">
                            <div className="pr-3 text-lg font-semibold">{selectedService.name}</div>
                            <div className="mt-2 flex items-start">
                                <Image
                                    src="/icons/location.svg"
                                    alt="icon"
                                    width={22}
                                    height={22}
                                    className="mt-1"
                                />

                                <div className="ml-2">
                                    <div className=" line-clamp-2 max-w-[200px] overflow-hidden text-ellipsis text-sm leading-tight text-gray-600">
                                        {selectedService.city}
                                    </div>
                                    <Link
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedService.latitude},${selectedService.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        <span>
                                            {t('navigate')}
                                        </span>
                                        <Image
                                            src="/icons/navigate.svg"
                                            alt="arrow"
                                            width={8}
                                            height={8}
                                            className={cn(
                                                'transition-transform duration-500 md:w-4 py-0.5 md:h-4 w-4 h-4 ',
                                            )}
                                        />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        </Popup>
    );
};
