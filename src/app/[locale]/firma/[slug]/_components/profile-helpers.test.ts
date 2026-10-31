import {
    getActionHrefs,
    getAddressedLocations,
    getHeaderCity,
    getMainLocation,
    getSocialLinks,
    toDisplayDomain,
    toNavigateHref,
    toSafeExternalHref,
    toSameAs,
    toWebsiteHref,
    toWhatsAppHref,
} from './profile-helpers';
import { localServiceFixture, makeLocation, onlineServiceFixture } from './profile-fixtures';

describe('getMainLocation', () => {
    it('wybiera lokalizacje oznaczona isMainLocation, nawet gdy nie jest pierwsza', () => {
        const branch = makeLocation({ id: 'branch', isMainLocation: false });
        const main = makeLocation({ id: 'main', isMainLocation: true });

        expect(getMainLocation([branch, main])?.id).toBe('main');
    });

    it('bez oznaczenia zwraca pierwsza, a dla pustej listy null', () => {
        const first = makeLocation({ id: 'first', isMainLocation: false });

        expect(getMainLocation([first])?.id).toBe('first');
        expect(getMainLocation([])).toBeNull();
    });
});

describe('getAddressedLocations', () => {
    it('stawia glowna lokalizacje na poczatku', () => {
        const result = getAddressedLocations(localServiceFixture);

        expect(result[0].isMainLocation).toBe(true);
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

describe('getHeaderCity', () => {
    it('przyjmuje sam zasieg i lokalizacje (np. wynik zapytania, bez budowania widoku)', () => {
        const locations = [makeLocation({ city: 'Gdańsk' })];

        expect(getHeaderCity({ coverage: 'local', locations })).toBe('Gdańsk');
        expect(getHeaderCity({ coverage: 'online', locations })).toBeNull();
    });
});

describe('toSafeExternalHref', () => {
    it('przepuszcza adresy http i https bez zmian (poza przycieciem spacji)', () => {
        expect(toSafeExternalHref('https://facebook.com/firma')).toBe('https://facebook.com/firma');
        expect(toSafeExternalHref(' http://firma.pl ')).toBe('http://firma.pl');
    });

    it.each([
        ['javascript:', 'javascript:alert(1)'],
        ['data:', 'data:text/html,<script>alert(1)</script>'],
        ['pusty', ''],
        ['bialy', '   '],
        ['bez protokolu', 'facebook.com/firma'],
        ['niepoprawny', 'https://'],
    ])('odrzuca adres %s', (_label, value) => {
        expect(toSafeExternalHref(value)).toBeNull();
    });

    it('brak wartosci (null) daje null', () => {
        expect(toSafeExternalHref(null)).toBeNull();
    });
});

describe('bezpieczne linki z socials', () => {
    const socials = {
        facebook: 'https://facebook.com/firma',
        instagram: '   ',
        tiktok: 'javascript:alert(1)',
        linkedin: 'data:text/html,x',
        x: '',
        telegram: 'https://t.me/firma',
    };

    it('ikony social media pomijaja puste, biale i niebezpieczne linki', () => {
        expect(getSocialLinks(socials)).toEqual([
            { key: 'facebook', href: 'https://facebook.com/firma' },
        ]);
    });

    it('sameAs w JSON-LD ma tylko bezpieczne linki', () => {
        expect(toSameAs(socials)).toEqual(['https://facebook.com/firma', 'https://t.me/firma']);
        expect(toSameAs(null)).toEqual([]);
    });

    it('Telegram i WhatsApp z socials tez przechodza przez allowliste', () => {
        const location = makeLocation({
            whatsappNumber: null,
            socials: { telegram: 'javascript:alert(1)', whatsapp: '  ' },
        });

        expect(getActionHrefs(location, false)).toMatchObject({ telegram: null, whatsapp: null });
    });
});
