import {
    getAddressedLocations,
    getMainLocation,
    getSocialLinks,
    toDisplayDomain,
    toNavigateHref,
    toWebsiteHref,
    toWhatsAppHref,
} from './profile-helpers';
import { localServiceFixture, makeLocation, onlineServiceFixture } from './profile-fixtures';

describe('getMainLocation', () => {
    it('wybiera lokalizacje oznaczona isMain, nawet gdy nie jest pierwsza', () => {
        const branch = makeLocation({ id: 'branch', isMain: false });
        const main = makeLocation({ id: 'main', isMain: true });

        expect(getMainLocation([branch, main])?.id).toBe('main');
    });

    it('bez oznaczenia zwraca pierwsza, a dla pustej listy null', () => {
        const first = makeLocation({ id: 'first', isMain: false });

        expect(getMainLocation([first])?.id).toBe('first');
        expect(getMainLocation([])).toBeNull();
    });
});

describe('getAddressedLocations', () => {
    it('stawia glowna lokalizacje na poczatku', () => {
        const result = getAddressedLocations(localServiceFixture);

        expect(result[0].isMain).toBe(true);
        expect(result).toHaveLength(localServiceFixture.locations.length);
    });

    it('dla wpisu online nie zwraca adresow, nawet gdy dane je maja', () => {
        const profile = {
            ...onlineServiceFixture,
            locations: [makeLocation({ street: 'Prosta 1', city: 'Warszawa' })],
        };

        expect(getAddressedLocations(profile)).toEqual([]);
    });

    it('pomija lokalizacje bez ulicy i miasta', () => {
        const profile = {
            ...localServiceFixture,
            locations: [makeLocation({ street: null, city: '  ' })],
        };

        expect(getAddressedLocations(profile)).toEqual([]);
    });
});

describe('linki kontaktowe', () => {
    it('dokleja https do adresu bez protokolu i pokazuje domene bez www', () => {
        expect(toWebsiteHref('www.firma.pl')).toBe('https://www.firma.pl');
        expect(toDisplayDomain('https://www.firma.pl/oferta')).toBe('firma.pl');
    });

    it('niepoprawny adres WWW wyswietla bez zmian', () => {
        expect(toDisplayDomain('http://')).toBe('http://');
    });

    it('WhatsApp: numer ma pierwszenstwo i traci znaki inne niz cyfry', () => {
        const location = makeLocation({
            whatsappNumber: '+48 600 100 200',
            socials: { whatsapp: 'https://wa.me/1' },
        });

        expect(toWhatsAppHref(location)).toBe('https://wa.me/48600100200');
        expect(toWhatsAppHref(makeLocation({ whatsappNumber: null, socials: null }))).toBeNull();
    });

    it('nawigacja wymaga obu wspolrzednych', () => {
        expect(toNavigateHref(makeLocation({ latitude: 52.1, longitude: 21.2 }))).toBe(
            'https://www.google.com/maps/dir/?api=1&destination=52.1,21.2',
        );
        expect(toNavigateHref(makeLocation({ latitude: null, longitude: 21.2 }))).toBeNull();
    });

    it('social media: tylko sieci z ikonami, w stalej kolejnosci', () => {
        const links = getSocialLinks({
            x: 'https://x.com/a',
            telegram: 'https://t.me/a',
            facebook: 'https://facebook.com/a',
        });

        expect(links.map(link => link.key)).toEqual(['facebook', 'x']);
        expect(getSocialLinks(null)).toEqual([]);
    });
});
