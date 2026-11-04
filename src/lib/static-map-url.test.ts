import { MAPBOX_PUBLIC_TOKEN } from '@/lib/mapbox';

import { buildStaticMapUrl } from './static-map-url';

const BASE = 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/';

describe('buildStaticMapUrl', () => {
    it('jeden pin: kadr wysrodkowany na nim (kolejnosc lng,lat), z przyblizeniem i @2x', () => {
        const url = buildStaticMapUrl({
            pins: [{ lat: 52.2316, lng: 21.0067 }],
            width: 1200,
            height: 400,
            zoom: 15,
            padding: 60,
        });

        expect(url).toBe(
            `${BASE}pin-l+c52289(21.00670,52.23160)/21.00670,52.23160,15,0/1200x400@2x?access_token=${MAPBOX_PUBLIC_TOKEN}`,
        );
    });

    it('kilka pinow: kadr auto z marginesem, kazdy pin w nakladce', () => {
        const url = buildStaticMapUrl({
            pins: [
                { lat: 52.2481, lng: 21.0927 },
                { lat: 52.0814, lng: 21.0239 },
            ],
            width: 1200,
            height: 400,
            zoom: 15,
            padding: 60,
        });

        expect(url).toContain(
            '/static/pin-l+c52289(21.09270,52.24810),pin-l+c52289(21.02390,52.08140)/auto/1200x400@2x?',
        );
        const params = new URL(url).searchParams;
        expect(params.get('padding')).toBe('60');
        expect(params.get('access_token')).toBe(MAPBOX_PUBLIC_TOKEN);
    });

    it('zaokragla wspolrzedne do 5 miejsc', () => {
        const url = buildStaticMapUrl({
            pins: [{ lat: 54.352_031_9, lng: -18.646_638_4 }],
            width: 600,
            height: 240,
            zoom: 16,
        });

        expect(url).toContain('pin-l+c52289(-18.64664,54.35203)/-18.64664,54.35203,16,0/');
    });

    it('powtorzone wspolrzedne to jeden pin z kadrem wysrodkowanym, nie auto', () => {
        const url = buildStaticMapUrl({
            pins: [
                { lat: 50, lng: 19 },
                { lat: 50.000_001, lng: 19 },
            ],
            width: 600,
            height: 240,
            zoom: 15,
            padding: 60,
        });

        expect(url).toContain('/static/pin-l+c52289(19.00000,50.00000)/19.00000,50.00000,15,0/');
        expect(url).not.toContain('padding');
    });

    it('sciezka nie wymaga kodowania URL', () => {
        const url = buildStaticMapUrl({
            pins: [
                { lat: -33.868_82, lng: 151.209_29 },
                { lat: 52.2316, lng: 21.0067 },
            ],
            width: 1200,
            height: 400,
            zoom: 15,
            padding: 60,
        });
        const { pathname } = new URL(url);

        expect(decodeURI(pathname)).toBe(pathname);
        expect(pathname).toMatch(/^[\w(),.+@/-]+$/);
    });
});
