import { Marker as GLMarker } from 'react-map-gl/mapbox';
import React, { CSSProperties, useEffect, useState } from 'react';
import { categoryImage } from '../_components/overview-map/utility';

type ClusterProps = {
    latitude: number;
    longitude: number;
    isSelected: boolean;
    counter?: number;
    onClick?: () => void;
    onMenuClick?: () => void;
    onHover: () => void;
    onHoverOut: () => void;
    category?: string | null; // Category to use for single-category clusters
};

const useAnimationStyles = () => {
    if (typeof document === 'undefined') return;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (!document.querySelector('#cluster-animations')) {
            const styleTag = document.createElement('style');
            styleTag.id = 'cluster-animations';
            styleTag.innerHTML = `
                @keyframes upAndDown {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                @keyframes fadeIn {
                    from { opacity: 0.5; }
                    to { opacity: 1; }
                }
            `;
            document.head.append(styleTag);

            return () => {
                const existingStyle = document.querySelector('#cluster-animations');
                if (existingStyle) {
                    existingStyle.remove();
                }
            };
        }
    }, []);
};

export const Cluster = ({
    latitude = 0,
    longitude = 0,
    isSelected,
    counter,
    onClick,
    onHover,
    onHoverOut,
    category,
}: ClusterProps) => {
    const [isHovered, setIsHovered] = useState(false);

    useAnimationStyles();

    // Handle mouse events
    const handleMouseEnter = () => {
        setIsHovered(true);
        onHover();
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        onHoverOut();
    };

    // Use category-specific icon if all items are from the same category, otherwise use default cluster icon
    const imageSource = categoryImage(category || 'cluster');

    // Properly type the style objects using CSSProperties
    const markerStyle: CSSProperties = {
        width: '34px',
        height: '34px',
        cursor: 'pointer',
        zIndex: isSelected ? 18 : 9,
        animation:
            isSelected && !isHovered
                ? 'upAndDown 1s ease-in-out infinite, fadeIn 0.5s ease-in-out'
                : undefined,
    };

    const counterStyle: CSSProperties = {
        position: 'relative',
        animation:
            isSelected && !isHovered
                ? 'upAndDown 1s ease-in-out infinite, fadeIn 0.5s ease-in-out'
                : undefined,
    };

    const markerZIndexStyle: CSSProperties = {
        zIndex: isSelected ? 18 : 0,
    };

    return (
        <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <GLMarker
                onClick={onClick}
                longitude={longitude}
                latitude={latitude}
                style={markerZIndexStyle}
            >
                {counter && (
                    <div style={counterStyle}>
                        <div
                            className="absolute -top-4 left-6 size-6 rounded-full 
                        border-2 border-gray-300 bg-black px-0 
                        text-center font-bold text-white"
                        >
                            {counter}
                        </div>
                    </div>
                )}
                <img src={imageSource} alt="cluster icon" style={markerStyle} />
            </GLMarker>
        </div>
    );
};
