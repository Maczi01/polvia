/**
 * @jest-environment node
 */
import { classifyLink, isSocialHost, normalizeHost } from './link-kind';

describe('normalizeHost', () => {
    it('zamienia na male litery i usuwa www.', () => {
        expect(normalizeHost('WWW.Firma.PL')).toBe('firma.pl');
    });

    it('nie rusza www w srodku hosta', () => {
        expect(normalizeHost('sklep.www-firma.pl')).toBe('sklep.www-firma.pl');
    });
});

describe('classifyLink', () => {
    it.each([
        ['https://www.instagram.com/x', 'instagram.com'],
        ['https://maps.app.goo.gl/AbCdEf123', 'maps.app.goo.gl'],
        ['https://m.facebook.com/firma', 'm.facebook.com'],
        ['https://t.me/firma', 't.me'],
        ['https://wa.me/48600100200', 'wa.me'],
        ['https://www.google.com/maps/place/Firma', 'google.com'],
        ['https://goo.gl/maps/xyz', 'goo.gl'],
        ['https://booksy.com/pl-pl/123_salon', 'booksy.com'],
        ['https://www.znanylekarz.pl/jan-kowalski', 'znanylekarz.pl'],
    ])('%s to link social', (url, host) => {
        expect(classifyLink(url)).toEqual({ kind: 'social', host });
    });

    it('zwykla strona to wlasna domena po normalizacji hosta', () => {
        expect(classifyLink('https://WWW.Firma.pl/o-nas')).toEqual({
            kind: 'own-domain',
            host: 'firma.pl',
        });
    });

    it('google.com bez /maps nie jest mapa', () => {
        expect(classifyLink('https://www.google.com/search?q=firma')).toEqual({
            kind: 'own-domain',
            host: 'google.com',
        });
    });

    it('domena podobna do serwisu social nie jest social', () => {
        expect(classifyLink('https://notinstagram.com/x').kind).toBe('own-domain');
    });

    it.each(['nie-url', '', 'javascript:alert(1)', 'mailto:a@b.pl', 'ftp://firma.pl'])(
        'niepoprawny lub nie-http link %p to invalid',
        url => {
            expect(classifyLink(url)).toEqual({ kind: 'invalid' });
        },
    );
});

describe('isSocialHost', () => {
    it('rozpoznaje subdomene serwisu', () => {
        expect(isSocialHost('pl.linkedin.com')).toBe(true);
    });

    it('zwraca false dla domeny wlasnej', () => {
        expect(isSocialHost('firma.pl')).toBe(false);
    });
});
