/**
 * @jest-environment node
 */
import { OWNER_EDIT_ERRORS, parseOwnerEdits } from '@/lib/add-business/owner-edits-schema';
import { POLAND_BOUNDS } from '@/lib/add-business/owner-pin-schema';

/** Social media, WhatsApp, checkbox godzin i reczna pinezka — pola dodane po testach usera. */

function form(overrides: Record<string, string> = {}): FormData {
    const values: Record<string, string> = {
        name: 'Kancelaria Nowak',
        city: 'Warszawa',
        languages: 'pl',
        submitterEmail: 'wlasciciel@nowak.pl',
        ...overrides,
    };
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) formData.append(key, value);
    return formData;
}

function parsedData(overrides: Record<string, string>) {
    const result = parseOwnerEdits(form(overrides));
    if (!result.ok) throw new Error(JSON.stringify(result.fieldErrors));
    return result.data;
}

describe('parseOwnerEdits — social media', () => {
    it('pelne URL-e i puste pola: w wyniku tylko niepuste linki', () => {
        const data = parsedData({
            'socials.facebook': 'https://www.facebook.com/nowak',
            'socials.youtube': 'https://youtube.com/@nowak',
            'socials.linkedin': '',
        });

        expect(data.socials).toEqual({
            facebook: 'https://www.facebook.com/nowak',
            youtube: 'https://youtube.com/@nowak',
        });
    });

    it('uchwyty @nazwa / nazwa normalizuje do pelnych URL-i serwisow', () => {
        const data = parsedData({
            'socials.telegram': '@nowak_law',
            'socials.instagram': 'nowak.kancelaria',
            'socials.tiktok': '@nowak',
            'socials.x': 'NowakLaw',
        });

        expect(data.socials).toEqual({
            telegram: 'https://t.me/nowak_law',
            instagram: 'https://www.instagram.com/nowak.kancelaria/',
            tiktok: 'https://www.tiktok.com/@nowak',
            x: 'https://x.com/NowakLaw',
        });
    });

    it('Threads: uchwyt @nazwa zamienia na threads.com, link threads.net zostawia', () => {
        expect(parsedData({ 'socials.threads': '@ikona.stone' }).socials).toEqual({
            threads: 'https://www.threads.com/@ikona.stone',
        });
        expect(parsedData({ 'socials.threads': 'https://www.threads.net/@nowak' }).socials).toEqual({
            threads: 'https://www.threads.net/@nowak',
        });
    });

    it('Threads: link do Instagrama w polu Threads to blad wrongSocialService', () => {
        expect(parseOwnerEdits(form({ 'socials.threads': 'https://www.instagram.com/nowak/' }))).toEqual({
            ok: false,
            fieldErrors: { 'socials.threads': OWNER_EDIT_ERRORS.wrongSocialService },
        });
    });

    it('link bez schematu dostaje https://', () => {
        expect(parsedData({ 'socials.facebook': 'facebook.com/nowak' }).socials).toEqual({
            facebook: 'https://facebook.com/nowak',
        });
    });

    it('link do innego serwisu niz pole to blad wrongSocialService', () => {
        const result = parseOwnerEdits(
            form({
                'socials.facebook': 'https://www.instagram.com/nowak/',
                'socials.linkedin': 'nowak',
            }),
        );

        expect(result).toEqual({
            ok: false,
            fieldErrors: {
                'socials.facebook': OWNER_EDIT_ERRORS.wrongSocialService,
                'socials.linkedin': OWNER_EDIT_ERRORS.wrongSocialService,
            },
        });
    });

    it('schemat inny niz http(s) to invalidUrl', () => {
        expect(parseOwnerEdits(form({ 'socials.youtube': 'javascript:alert(1)' }))).toEqual({
            ok: false,
            fieldErrors: { 'socials.youtube': OWNER_EDIT_ERRORS.invalidUrl },
        });
    });

    it('link dluzszy niz 255 znakow to tooLong', () => {
        const long = `https://www.facebook.com/${'a'.repeat(240)}`;

        expect(parseOwnerEdits(form({ 'socials.facebook': long }))).toEqual({
            ok: false,
            fieldErrors: { 'socials.facebook': OWNER_EDIT_ERRORS.tooLong },
        });
    });
});

describe('parseOwnerEdits — WhatsApp', () => {
    it('numer normalizuje do +<cyfry>, 9 cyfr = numer polski', () => {
        expect(parsedData({ whatsappNumber: '+48 500-600-700' }).whatsappNumber).toBe(
            '+48500600700',
        );
        expect(parsedData({ whatsappNumber: '500 600 700' }).whatsappNumber).toBe(
            '+48500600700',
        );
    });

    it('litery i nawiasy to invalidPhone, ponad 20 znakow to tooLong', () => {
        expect(parseOwnerEdits(form({ whatsappNumber: 'zadzwon' }))).toEqual({
            ok: false,
            fieldErrors: { whatsappNumber: OWNER_EDIT_ERRORS.invalidPhone },
        });
        expect(parseOwnerEdits(form({ whatsappNumber: '+48 500 600 700 800 900' }))).toEqual({
            ok: false,
            fieldErrors: { whatsappNumber: OWNER_EDIT_ERRORS.tooLong },
        });
    });

    it('link wa.me/<cyfry> w socials.whatsapp staje sie numerem, gdy numeru nie podano', () => {
        const data = parsedData({ 'socials.whatsapp': 'https://wa.me/48500600700' });

        expect(data.whatsappNumber).toBe('+48500600700');
        expect(data.socials).toEqual({});
    });

    it('podany numer wygrywa z numerem z linku', () => {
        const data = parsedData({
            whatsappNumber: '+48 111 222 333',
            'socials.whatsapp': 'https://wa.me/48500600700',
        });

        expect(data.whatsappNumber).toBe('+48111222333');
    });
});

describe('parseOwnerEdits — checkbox godzin', () => {
    it('brak hoursEnabled: wpis bez godzin i bez bledow pol hours.*', () => {
        const data = parsedData({
            'hours.monday.open': '9:00',
            'hours.monday.close': '',
            'hours.tuesday.open': '10:00',
            'hours.tuesday.close': '18:00',
        });

        expect(data.openingHours).toBeNull();
    });

    it("hoursEnabled='on' waliduje godziny jak dotad", () => {
        expect(
            parseOwnerEdits(form({ hoursEnabled: 'on', 'hours.monday.open': '09:00' })),
        ).toEqual({
            ok: false,
            fieldErrors: { 'hours.monday.close': OWNER_EDIT_ERRORS.incompleteHours },
        });
        expect(
            parsedData({
                hoursEnabled: 'on',
                'hours.monday.open': '09:00',
                'hours.monday.close': '17:00',
            }).openingHours,
        ).toEqual({ monday: { open: '09:00', close: '17:00' } });
    });
});

describe('parseOwnerEdits — reczna pinezka', () => {
    it('para wspolrzednych w Polsce daje pin', () => {
        expect(parsedData({ pinLat: '52.2297', pinLng: '21.0122' }).pin).toEqual({
            lat: 52.2297,
            lng: 21.0122,
        });
    });

    it("puste pola ('') to brak pinu, nie 0", () => {
        expect(parsedData({ pinLat: '', pinLng: '' }).pin).toBeNull();
        expect(parsedData({}).pin).toBeNull();
    });

    it.each([
        { pinLat: '52.2297', pinLng: '' },
        { pinLat: '', pinLng: '21.0122' },
        { pinLat: 'abc', pinLng: '21.0122' },
        { pinLat: 'Infinity', pinLng: '21.0122' },
    ])('niepelna albo zla para %o to blad pola pin', pin => {
        expect(parseOwnerEdits(form(pin))).toEqual({
            ok: false,
            fieldErrors: { pin: OWNER_EDIT_ERRORS.invalidValue },
        });
    });

    it.each([
        { pinLat: '48.8566', pinLng: '2.3522' },
        { pinLat: String(POLAND_BOUNDS.maxLat + 0.1), pinLng: '18' },
        { pinLat: '52', pinLng: String(POLAND_BOUNDS.minLng - 0.1) },
    ])('pin poza Polska %o to pinOutsidePoland', pin => {
        expect(parseOwnerEdits(form(pin))).toEqual({
            ok: false,
            fieldErrors: { pin: OWNER_EDIT_ERRORS.pinOutsidePoland },
        });
    });
});
