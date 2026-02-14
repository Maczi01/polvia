import React from 'react';
import { Popup } from 'react-map-gl/mapbox';
import Image from 'next/image';

type PopupContentProps = {
    selectedPlaceId?: number | null;
    latitude?: number;
    longitude?: number;
    array?: any[];
    onClose?: () => void;
    hidePopup?: () => void;
    isMobile?: boolean;
};

const mockArray = [
    {
        id: 1,
        name: 'Husar Transport',
        image: '/serviceImages/husar.png',
        latitude: 52.229_77,
        longitude: 21.011_78,
    },
    {
        id: 2,
        name: 'Husar Transport',
        image: '/serviceImages/husar.png',
        latitude: 52.229_77,
        longitude: 21.011_78,
    },
    {
        id: 3,
        name: 'Husar Transport',
        image: '/serviceImages/husar.png',
        latitude: 52.229_77,
        longitude: 21.011_78,
    },
    {
        id: 4,
        name: 'Husar Transport',
        image: '/serviceImages/husar.png',
        latitude: 52.229_77,
        longitude: 21.011_78,
    },
];

export const ClusterPopup = ({
    latitude,
    longitude,
    onClose,
    selectedPlaceId,
    array,
    hidePopup,
    isMobile,
}: PopupContentProps) => {
    // const t = useTranslations('MapPopup');
    if (!selectedPlaceId || isMobile) return null;

    return (
        <Popup
            longitude={longitude!}
            latitude={latitude!}
            closeOnClick={false}
            onClose={onClose}
            focusAfterOpen={false}
        >
            <div className="z-50 flex max-h-60 flex-col overflow-hidden rounded-t-lg bg-white text-black shadow-md">
                {/* Scrollable container with right padding */}
                <div className="scrollbar-custom w-full overflow-y-auto pr-3 pt-2">
                    {mockArray?.map(place => (
                        <div
                            key={place.id}
                            className="my-0.5 flex h-16 w-full items-center justify-center
                                   border-b border-gray-300
                                   px-3 transition duration-300 ease-in-out hover:cursor-pointer hover:bg-gray-100"
                        >
                            <Image
                                src={place.image}
                                alt="workshop logo"
                                className="mr-2 size-12 rounded-full"
                                height={48}
                                width={48}
                            />
                            <div className="flex grow flex-col justify-center text-center text-xl">
                                {place.name}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Popup>
    );
};
