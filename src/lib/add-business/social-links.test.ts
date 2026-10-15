/**
 * @jest-environment node
 */
import {
    normalizeWhatsappNumber,
    socialKeyForUrl,
    socialLinksFromUrls,
    whatsappNumberFromUrl,
} from '@/lib/add-business/social-links';

describe('socialKeyForUrl', () => {
    it.each([
        ['https://www.facebook.com/ifiorawarsaw/', 'facebook'],
        ['https://m.facebook.com/ifiora', 'facebook'],
        ['https://www.instagram.com/ifiora_warsaw/', 'instagram'],
        ['https://t.me/workupeu', 'telegram'],
        ['https://www.tiktok.com/@workupeu', 'tiktok'],
        ['https://youtu.be/abc', 'youtube'],
        ['https://www.threads.com/@ikonastone', 'threads'],
        ['https://www.threads.net/@ikonastone', 'threads'],
        ['https://pl.linkedin.com/company/nowak', 'linkedin'],
        ['https://twitter.com/ifiora', 'x'],
        ['https://www.tripadvisor.co.uk/Restaurant_Review-g1', 'tripadvisor'],
        ['https://wa.me/48500600700', 'whatsapp'],
    ])('%s to %s', (url, key) => {
        expect(socialKeyForUrl(url)).toBe(key);
    });

    it.each(['https://nowak.pl', 'javascript:alert(1)', 'facebook.com/nowak', 'https://fakefacebook.com'])(
        '%s nie jest linkiem do serwisu',
        url => {
            expect(socialKeyForUrl(url)).toBeNull();
        },
    );
});

describe('normalizeWhatsappNumber', () => {
    it.each([
        ['+48 500 600 700', '+48500600700'],
        ['500-600-700', '+48500600700'],
        ['0048 500 600 700', '+48500600700'],
        ['+380 67 123 45 67', '+380671234567'],
    ])('%s → %s', (raw, expected) => {
        expect(normalizeWhatsappNumber(raw)).toBe(expected);
    });

    it.each(['abc', '+48 (500) 600 700', '12', '+48 5++00', '1234567890123456'])(
        '%s nie jest numerem',
        raw => {
            expect(normalizeWhatsappNumber(raw)).toBeNull();
        },
    );
});

describe('whatsappNumberFromUrl', () => {
    it('wyciaga numer z wa.me i api.whatsapp.com', () => {
        expect(whatsappNumberFromUrl('https://wa.me/48500600700')).toBe('+48500600700');
        expect(whatsappNumberFromUrl('https://api.whatsapp.com/send?phone=48500600700')).toBe(
            '+48500600700',
        );
    });

    it('link bez numeru daje null', () => {
        expect(whatsappNumberFromUrl('https://wa.me/message/ABC123')).toBeNull();
    });
});

describe('socialLinksFromUrls', () => {
    it('rozpoznaje serwisy, link wa.me z numerem idzie do whatsappNumber, obce pomija', () => {
        const result = socialLinksFromUrls([
            'https://www.facebook.com/nowak',
            'https://www.facebook.com/drugi-profil',
            'https://nowak.pl/kontakt',
            'https://wa.me/48500600700',
            'https://t.me/nowak',
        ]);

        expect(result).toEqual({
            socials: { facebook: 'https://www.facebook.com/nowak', telegram: 'https://t.me/nowak' },
            whatsappNumber: '+48500600700',
        });
    });

    it('link dluzszy niz kolumna jest pomijany', () => {
        const long = `https://www.instagram.com/${'a'.repeat(300)}`;

        expect(socialLinksFromUrls([long])).toEqual({ socials: {}, whatsappNumber: null });
    });
});
