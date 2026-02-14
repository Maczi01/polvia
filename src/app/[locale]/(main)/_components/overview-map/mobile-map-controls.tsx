import React from 'react';
import { MapRef } from 'react-map-gl/mapbox';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utilities';
import { Button } from '@/components/ui/button/button';

interface MobileMapControlsProps {
    mapRef: React.RefObject<MapRef | null>;
    // onClick: () => void
}

export const MobileMapControls: React.FC<MobileMapControlsProps> = ({ mapRef }) => {
    const handleZoomIn = () => {
        if (mapRef.current?.getMap()) {
            mapRef.current.getMap().zoomIn();
        }
    };

    const handleZoomOut = () => {
        if (mapRef.current?.getMap()) {
            mapRef.current.getMap().zoomOut();
        }
    };

    return (
        <div className="absolute right-1 top-14 z-10 flex flex-col gap-2">
            <Button
                variant="green"
                onClick={handleZoomIn}
                className={cn('md:w-24 transition-transform duration-150 active:scale-90')}
                aria-label="Zoom in"
            >
                <Plus size={24} />
            </Button>
            <Button
                variant="green"
                onClick={handleZoomOut}
                className={cn('md:w-24 transition-transform duration-150 active:scale-90')}
                aria-label="Zoom out"
            >
                <Minus size={24} />
            </Button>
        </div>
    );
};
