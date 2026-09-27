import type Supercluster from 'supercluster';
import { PointFeature } from 'supercluster';
import { CATEGORY_DEFINITIONS, isCategory } from '@/lib/categories';
import { ItemPointClusterProperties, ItemPointFeatureProperties, PartialService } from '@/types';

const CLUSTER_MARKER = '/markers/glass.svg';
const DEFAULT_MARKER = '/markers/default.svg';

export const categoryImage = (category: string): string => {
    if (category === 'cluster') return CLUSTER_MARKER;
    return isCategory(category) ? CATEGORY_DEFINITIONS[category].marker : DEFAULT_MARKER;
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
    // Mapa pokazuje WYLACZNIE to, co mozna odwiedzic (R3). Dwa warunki:
    //
    // 1. Wspolrzedne musza istniec — bez nich nie ma gdzie postawic pinu.
    // 2. Zasieg `online` nie dostaje pinu NAWET ze wspolrzednymi. Wpis w pelni
    //    zdalny moze miec adres rejestrowy (FotoDoKarty: Al. Solidarnosci
    //    w Warszawie), ale nie ma punktu obslugi — pin mowilby "przyjdz tu",
    //    a nie ma gdzie przyjsc.
    //
    // Wykluczenie dziala u zrodla, wiec clustering, `bounds` i supercluster nie
    // wymagaja zadnych wyjatkow. `hybrid` dostaje pin automatycznie.
    return items
        .filter(
            (item): item is LocatedService =>
                item.coverage !== 'online' && item.latitude != null && item.longitude != null,
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

/** Najwiekszy zoom, do jakiego przybliza mapa (przycisk `+`). */
export const MAX_MAP_ZOOM = 20;

/**
 * Klaster, ktorego nie rozdzieli zadne przyblizenie — wpisy stoja pod tym samym
 * adresem (jeden budynek albo zastepczy adres w centrum miasta). Klikniecie
 * takiego klastra musi pokazac liste wpisow, bo `fitBounds` na obszar zerowej
 * wielkosci przybliza mape do oporu, a licznik zostaje.
 */
export function isStackedCluster(
    index: Supercluster<ItemPointFeatureProperties, ItemPointClusterProperties>,
    clusterId: number,
): boolean {
    return index.getClusterExpansionZoom(clusterId) > MAX_MAP_ZOOM;
}
