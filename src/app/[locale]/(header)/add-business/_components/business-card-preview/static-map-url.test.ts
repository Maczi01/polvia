import { MAPBOX_PUBLIC_TOKEN, staticMapUrl } from './static-map-url';

describe('staticMapUrl', () => {
    it('stawia pin i centruje kadr na wspolrzednych (kolejnosc lng,lat)', () => {
        const url = staticMapUrl({ lat: 54.352_031, lng: 18.646_638, approximate: false });

        expect(url).toContain('/static/pin-l+c52289(18.64664,54.35203)/18.64664,54.35203,16,0/');
        expect(url.startsWith('https://api.mapbox.com/styles/v1/mapbox/streets-v12/')).toBe(true);
    });

    it('pin przyblizony dostaje szerszy kadr', () => {
        const url = staticMapUrl({ lat: 50, lng: 19, approximate: true });

        expect(url).toContain('/19.00000,50.00000,13,0/');
    });

    it('uzywa wylacznie publicznego tokenu', () => {
        expect(MAPBOX_PUBLIC_TOKEN.startsWith('pk.')).toBe(true);
        expect(staticMapUrl({ lat: 50, lng: 19, approximate: false })).toContain(
            `access_token=${MAPBOX_PUBLIC_TOKEN}`,
        );
    });
});
