import { Marker as GLMarker } from 'react-map-gl/mapbox';
import Image from 'next/image';
import { categoryImage } from './utility';

const upAndDown = `
  @keyframes upAndDown {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
`;

const shakeAnimation = `
  @keyframes shake {
    0% { 
      transform: rotate(0deg); 
      transform-origin: center bottom;
    }
    15% { 
      transform: rotate(14deg); 
      transform-origin: center bottom;
    }
    45% { 
      transform: rotate(-14deg); 
      transform-origin: center bottom;
    }
    75% { 
      transform: rotate(4deg); 
      transform-origin: center bottom;
    }
    100% { 
      transform: rotate(0deg); 
      transform-origin: center bottom;
    }
  }
`;

type MarkerProps = {
    latitude: number;
    longitude: number;
    isSelected?: boolean;
    category: string;
    counter?: number;
    onClick?: () => void;
};

export const Marker = ({ latitude, longitude, isSelected, category, onClick }: MarkerProps) => {
    const markerStyle = {
        width: '34px',
        height: '34px',
        cursor: 'pointer',
        zIndex: isSelected ? 18 : 9,
        animation: isSelected ? `upAndDown 1s ease-in-out infinite, fadeIn 0.5s ease-in-out` : '',
        transition: 'all 0.2s ease-in-out',
    };

    if (isSelected) {
        const styleTag = document.createElement('style');
        styleTag.innerHTML = upAndDown;
        document.head.append(styleTag);
    }

    // Add shake animation styles to document head
    const shakeStyleTag = document.createElement('style');
    shakeStyleTag.innerHTML = shakeAnimation;
    if (!document.head.querySelector('style[data-shake-animation]')) {
        shakeStyleTag.dataset.shakeAnimation = 'true';
        document.head.append(shakeStyleTag);
    }

    const imageSource = categoryImage(category);

    return (
        <GLMarker
            onClick={onClick}
            longitude={longitude}
            latitude={latitude}
            style={{ zIndex: isSelected ? 18 : 0 }}
        >
            <div
                style={{
                    position: 'relative',
                    animation: isSelected ? `upAndDown 1s ease-in-out infinite, fadeIn 0.5s ease-in-out` : '',
                }}
            ></div>
            <Image
                src={imageSource}
                width={48}
                height={48}
                alt="shop icon"
                style={markerStyle}
                onMouseEnter={(e) => {
                    e.currentTarget.style.animation = 'shake 0.6s ease-out';
                }}
                onAnimationEnd={(e) => {
                    if (e.animationName === 'shake') {
                        e.currentTarget.style.animation = isSelected ? `upAndDown 1s ease-in-out infinite, fadeIn 0.5s ease-in-out` : '';
                    }
                }}
            />
        </GLMarker>
    );
};