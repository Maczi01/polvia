// lib/map-utils.ts - Simplified version
import { PartialService } from '@/types';

export function calculateServicesBounds(services: PartialService[]) {
    if (services.length === 0) return null;

    const validServices = services.filter(s => s.latitude != null && s.longitude != null);
    if (validServices.length === 0) return null;

    const lats = validServices.map(s => s.latitude);
    const lngs = validServices.map(s => s.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding
    const minPadding = 0.005; // ~500m
    const latPadding = Math.max((maxLat - minLat) * 0.15, minPadding);
    const lngPadding = Math.max((maxLng - minLng) * 0.15, minPadding);

    // Return in the format fitBounds expects: [[lng, lat], [lng, lat]]
    return [
        [minLng - lngPadding, minLat - latPadding], // Southwest corner
        [maxLng + lngPadding, maxLat + latPadding]  // Northeast corner
    ];
}