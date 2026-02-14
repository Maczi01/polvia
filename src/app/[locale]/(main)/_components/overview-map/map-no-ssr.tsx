// components/Map/MapNoSSR.tsx
import dynamic from 'next/dynamic';

// Import any types you need but NOT the actual react-map-gl directly
// import type { MapRef } from 'react-map-gl';

// Dynamically import the Map component from `react-map-gl`
const MapNoSsr = dynamic(() => import('react-map-gl/mapbox'), {
    ssr: false,
});

export default MapNoSsr;
