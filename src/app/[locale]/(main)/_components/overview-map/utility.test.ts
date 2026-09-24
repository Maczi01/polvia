import Supercluster from 'supercluster';

import type { ItemPointClusterProperties, ItemPointFeatureProperties, PartialService } from '@/types';

import { createPoints, isStackedCluster, mapFeature, reduceCluster } from './utility';

let counter = 0;

function service(overrides: Partial<PartialService> = {}): PartialService {
    counter += 1;
    return {
        id: `id-${counter}`,
        serviceId: `service-${counter}`,
        slug: `slug-${counter}`,
        name: `Usluga ${counter}`,
        description: null,
        category: 'financial',
        coverage: 'local',
        tags: null,
        city: 'Warszawa',
        street: null,
        voivodeship: 'mazowieckie',
        postcode: null,
        latitude: 52.2297,
        longitude: 21.0122,
        openingHours: {},
        phoneNumber: null,
        email: null,
        webpage: null,
        image: null,
        languages: ['pl'],
        socials: null,
        whatsappNumber: null,
        verified: false,
        ...overrides,
    };
}

describe('createPoints — mapa pokazuje tylko to, co mozna odwiedzic', () => {
    it('wpis `online` ze wspolrzednymi NIE tworzy pinu', () => {
        // FotoDoKarty ma adres rejestrowy, ale nie ma punktu obslugi — pin
        // mowilby "przyjdz tu", a nie ma gdzie przyjsc (R3).
        const online = service({ coverage: 'online', latitude: 52.2297, longitude: 21.0122 });

        expect(createPoints([online])).toHaveLength(0);
    });

    it('wpis `hybrid` ze wspolrzednymi tworzy pin', () => {
        const hybrid = service({ coverage: 'hybrid' });

        const points = createPoints([hybrid]);

        expect(points).toHaveLength(1);
        expect(points[0].geometry.coordinates).toEqual([hybrid.longitude, hybrid.latitude]);
    });

    it('wpis `local` ze wspolrzednymi tworzy pin', () => {
        const local = service({ coverage: 'local' });

        expect(createPoints([local])).toHaveLength(1);
    });

    it('wpis `local` bez szerokosci NIE tworzy pinu i nie rzuca wyjatku', () => {
        const bezSzerokosci = service({ coverage: 'local', latitude: null });

        expect(() => createPoints([bezSzerokosci])).not.toThrow();
        expect(createPoints([bezSzerokosci])).toHaveLength(0);
    });

    it('wpis bez dlugosci geograficznej NIE tworzy pinu', () => {
        const bezDlugosci = service({ coverage: 'local', longitude: null });

        expect(createPoints([bezDlugosci])).toHaveLength(0);
    });

    it('pusta lista daje pusta liste', () => {
        expect(createPoints([])).toEqual([]);
    });

    it('mieszana lista — tylko wpisy odwiedzalne ze wspolrzednymi', () => {
        const items = [
            service({ coverage: 'local' }),
            service({ coverage: 'hybrid' }),
            service({ coverage: 'online', latitude: null, longitude: null }),
            service({ coverage: 'online', latitude: 52, longitude: 21 }),
            service({ coverage: 'local', latitude: null, longitude: null }),
        ];

        const points = createPoints(items);

        expect(points).toHaveLength(2);
        expect(points.map(point => point.id)).toEqual([items[0].id, items[1].id]);
    });

    it('zachowuje kolejnosc wejsciowa', () => {
        const pierwszy = service();
        const drugi = service();
        const trzeci = service();

        const points = createPoints([pierwszy, drugi, trzeci]);

        expect(points.map(point => point.id)).toEqual([pierwszy.id, drugi.id, trzeci.id]);
    });
});

describe('isStackedCluster — klaster, ktorego nie da sie rozdzielic przyblizeniem', () => {
    function clusterOf(services: PartialService[]) {
        const index = new Supercluster<ItemPointFeatureProperties, ItemPointClusterProperties>({
            map: mapFeature,
            reduce: reduceCluster,
            extent: 512,
            minZoom: 0,
            maxZoom: 24,
            radius: 75,
        });
        index.load(createPoints(services));
        const [feature] = index.getClusters([-180, -85, 180, 85], 5);
        if (!feature?.properties.cluster) throw new Error('Fixture nie utworzyl klastra');
        return { index, clusterId: feature.properties.cluster_id };
    }

    it('wpisy pod identycznym adresem (zastepczy adres w centrum miasta) to stos', () => {
        const { index, clusterId } = clusterOf([service(), service(), service()]);

        expect(isStackedCluster(index, clusterId)).toBe(true);
    });

    it('wpisy w roznych czesciach miasta NIE sa stosem — przyblizenie je rozdzieli', () => {
        const { index, clusterId } = clusterOf([
            service({ latitude: 52.2297, longitude: 21.0122 }),
            service({ latitude: 52.2, longitude: 20.95 }),
        ]);

        expect(isStackedCluster(index, clusterId)).toBe(false);
    });
});
