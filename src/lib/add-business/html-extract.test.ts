/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { extractPage, HtmlExtractError, MAX_TEXT_LENGTH } from './html-extract';
import { mapOpeningHours } from './jsonld-facts';

function fixture(name: string): string {
    return readFileSync(
        path.join(process.cwd(), 'tests', 'fixtures', 'add-business', name),
        'utf8',
    );
}

let warnSpy: jest.SpyInstance;

beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    warnSpy.mockRestore();
});

describe('extractPage — LocalBusiness', () => {
    const run = (): ReturnType<typeof extractPage> =>
        extractPage(fixture('local-business-jsonld.html'), 'https://gabinet-zdrowie.pl/');

    it('wyciaga adres, telefon, email, geo i sameAs', () => {
        expect(run().facts).toMatchObject({
            name: 'Gabinet Zdrowie',
            telephone: '+48 22 123 45 67',
            email: 'kontakt@gabinet-zdrowie.pl',
            address: {
                street: 'ul. Marszałkowska 10',
                city: 'Warszawa',
                postcode: '00-001',
                country: 'PL',
            },
            geo: { latitude: 52.2297, longitude: 21.0122 },
            sameAs: [
                'https://www.instagram.com/gabinetzdrowie',
                'https://www.facebook.com/gabinetzdrowie',
            ],
        });
    });

    it('mapuje godziny na dni lowercase w formacie HH:MM', () => {
        expect(run().facts.openingHours).toEqual({
            monday: { open: '09:00', close: '17:00' },
            tuesday: { open: '09:00', close: '17:00' },
            wednesday: { open: '09:00', close: '17:00' },
            thursday: { open: '09:00', close: '17:00' },
            friday: { open: '09:00', close: '17:00' },
            saturday: { open: '10:00', close: '14:00' },
        });
    });

    it('zwraca kandydatow logo w kolejnosci og:image, apple-touch-icon, icon', () => {
        expect(run().logoCandidates).toEqual([
            'https://cdn.gabinet-zdrowie.pl/og/logo.png',
            'https://gabinet-zdrowie.pl/apple-touch-icon.png',
            'https://gabinet-zdrowie.pl/favicon.ico',
        ]);
    });

    it('bierze linki kontaktu tylko z tego samego originu, najwyzej dwa', () => {
        expect(run().contactLinks).toEqual([
            'https://gabinet-zdrowie.pl/kontakt',
            'https://gabinet-zdrowie.pl/en/contact-us',
        ]);
    });

    it('zachowuje stopke i usuwa skrypty oraz style z tekstu', () => {
        const { text } = run();

        expect(text).toContain('ul. Marszałkowska 10, 00-001 Warszawa');
        expect(text).not.toContain('secret-tracking-code');
        expect(text).not.toContain('color: red');
    });
});

describe('extractPage — @graph i zepsuty blok', () => {
    const run = (): ReturnType<typeof extractPage> =>
        extractPage(fixture('graph-jsonld.html'), 'https://lex.pl/o-nas');

    it('nie rzuca i loguje zepsuty blok', () => {
        expect(run).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith(
            'JSON-LD block skipped',
            expect.objectContaining({ index: 0 }),
        );
    });

    it('wyciaga wezel firmy z @graph i pomija niepoprawne pola', () => {
        const { facts } = run();

        expect(facts.name).toBe('Kancelaria Lex');
        expect(facts.telephone).toBe('+48 12 555 66 77');
        expect(facts.address).toEqual({ raw: 'ul. Floriańska 1, 31-019 Kraków' });
        expect(facts.openingHours).toEqual({ monday: { open: '08:30', close: '16:00' } });
        expect(facts.sameAs).toEqual(['https://www.linkedin.com/company/lex']);
        // email bez @ i szerokosc 999 nie przechodza walidacji, a Organization ich nie uzupelnia
        expect(facts.email).toBeUndefined();
        expect(facts.geo).toBeUndefined();
    });

    it('liczy wzgledny apple-touch-icon wzgledem finalUrl, gdy brak og:image', () => {
        expect(run().logoCandidates).toEqual([
            'https://lex.pl/img/touch.png',
            'https://lex.pl/favicon.png',
        ]);
    });

    it('deduplikuje linki kontaktu po usunieciu kotwicy', () => {
        expect(run().contactLinks).toEqual([
            'https://lex.pl/kontakt/',
            'https://lex.pl/%D0%BA%D0%BE%D0%BD%D1%82%D0%B0%D0%BA%D1%82',
        ]);
    });
});

describe('extractPage — bez JSON-LD', () => {
    const run = (): ReturnType<typeof extractPage> =>
        extractPage(fixture('no-jsonld.html'), 'https://pralnia-babel.pl/');

    it('zwraca puste fakty strukturalne i nic nie loguje', () => {
        expect(run().facts).toEqual({});
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('zwraca niepusty tekst bez skryptow, noscript, svg, ze zwinietymi bialymi znakami', () => {
        const { text } = run();

        expect(text).toContain('Pralnia Bąbel');
        expect(text).toContain('Pranie dywanów i tapicerki.');
        expect(text).toContain('Tel. 600 100 200, Gdańsk');
        expect(text).not.toMatch(/tracking-script-content|inline-script-content/);
        expect(text).not.toMatch(/Włącz JavaScript|ikona-svg-tekst/);
        expect(text).not.toMatch(/\s{2,}/);
    });

    it('rozwiazuje icon z adresem protocol-relative', () => {
        expect(run().logoCandidates).toEqual(['https://static.pralnia-babel.pl/favicon.svg']);
    });

    it('bez linku kontaktu proponuje /kontakt i /contact', () => {
        expect(run().contactLinks).toEqual([
            'https://pralnia-babel.pl/kontakt',
            'https://pralnia-babel.pl/contact',
        ]);
    });
});

describe('extractPage — przypadki brzegowe', () => {
    it('przycina tekst do limitu', () => {
        const html = `<body><p>${'a '.repeat(MAX_TEXT_LENGTH)}</p></body>`;

        expect(extractPage(html, 'https://firma.pl/').text).toHaveLength(MAX_TEXT_LENGTH);
    });

    it.each(['nie-url', '/wzgledny', 'ftp://firma.pl/'])(
        'rzuca HtmlExtractError dla finalUrl %p',
        finalUrl => {
            expect(() => extractPage('<p>x</p>', finalUrl)).toThrow(HtmlExtractError);
        },
    );
});

describe('mapOpeningHours', () => {
    it('pomija wpisy bez godzin, z nieznanym dniem i z godzina spoza zakresu', () => {
        expect(
            mapOpeningHours([
                { dayOfWeek: 'Sunday' },
                { dayOfWeek: 'Holiday', opens: '09:00', closes: '12:00' },
                { dayOfWeek: 'Friday', opens: '25:00', closes: '12:00' },
                { dayOfWeek: 'http://schema.org/Thursday', opens: '07:05', closes: '15:00' },
            ]),
        ).toEqual({ thursday: { open: '07:05', close: '15:00' } });
    });

    it('zwraca pusty obiekt dla niepoprawnego wejscia', () => {
        expect(mapOpeningHours('pon-pt 9-17')).toEqual({});
    });
});
