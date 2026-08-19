import { PointFeature } from 'supercluster';
import { ItemPointClusterProperties, ItemPointFeatureProperties, PartialService } from '@/types';

export const categoryImage = (category: string) => {
    switch (category) {
        case 'grocery':
            return '/markers/grocery.svg';
        case 'education':
            return '/markers/education.svg';
        case 'law':
            return '/markers/law.svg';
        case 'transport':
            return '/markers/transport.svg';
        case 'mechanics':
            return '/markers/mechanics.svg';
        case 'beauty':
            return '/markers/beauty.svg';
        case 'financial':
            return '/markers/financial.svg';
        case 'health':
            return '/markers/health.svg';
        case 'renovation':
            return '/markers/renovation.svg';
        case 'gov':
            return '/markers/gov.svg';
        case 'real_estate':
            return '/markers/real-estate.svg';
        case 'help_support':
            return '/markers/help-support.svg';
        case 'others':
            return '/markers/others.svg';
        case 'cluster':
            return '/markers/glass.svg';
        case 'government':
            return '/markers/government.svg';
        case 'gastronomy':
            return '/markers/gastronomy.svg';
        default:
            return '/markers/default.svg';
    }
};

export const initialViewState = {
    latitude: 51.960_298_484_367_69,
    longitude: 19.210_655_292_701_76,
    zoom: 5.55,
    bearing: 0,
    pitch: 0,
};

/** Usluga, ktora da sie postawic na mapie — ma oba wspolrzedne. */
export type LocatedService = PartialService & { latitude: number; longitude: number };

export function createPoint(
    item: LocatedService,
): PointFeature<ItemPointFeatureProperties> {
    const { longitude, latitude } = item;
    return {
        type: 'Feature',
        properties: { item, cluster: false, items: [item] },
        id: item.id,
        geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
        },
    };
}

export function createPoints(
    items: PartialService[],
): PointFeature<ItemPointFeatureProperties>[] {
    // Pin wymaga wspolrzednych. Warunek na `coverage` (brak pinu dla `online`)
    // dochodzi w U7 — tutaj wylacznie zawezenie typu po nullowalnosci.
    return items
        .filter(
            (item): item is LocatedService =>
                item.latitude != null && item.longitude != null,
        )
        .map(createPoint);
}

export function mapFeature(properties: ItemPointFeatureProperties): ItemPointClusterProperties {
    return { items: [properties.item] };
}

export function reduceCluster(
    memo: ItemPointClusterProperties,
    properties: ItemPointClusterProperties,
): void {
    memo.items = memo.items.concat(properties.items);
}
