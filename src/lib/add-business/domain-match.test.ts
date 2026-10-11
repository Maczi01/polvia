/**
 * @jest-environment node
 */
// jsdom nie ma `URL.canParse`.
import { domainLikePatterns, escapeLikePattern, hostOfWebpage, pickByHost } from './domain-match';

describe('escapeLikePattern', () => {
    it('escapuje %, _ i backslash', () => {
        expect(escapeLikePattern(String.raw`a%b_c\d`)).toBe(String.raw`a\%b\_c\\d`);
    });

    it('zwykly host zostawia bez zmian', () => {
        expect(escapeLikePattern('kancelaria-test.pl')).toBe('kancelaria-test.pl');
    });
});

describe('domainLikePatterns', () => {
    it('zakotwicza host po schemacie i na poczatku wartosci, z www i bez', () => {
        expect(domainLikePatterns('art.pl')).toEqual([
            '%://art.pl%',
            '%://www.art.pl%',
            'art.pl%',
            'www.art.pl%',
        ]);
    });

    it('normalizuje host: wielkie litery, www. i biale znaki', () => {
        expect(domainLikePatterns('  WWW.Art.PL ')).toEqual(domainLikePatterns('art.pl'));
    });

    it('escapuje znaki specjalne LIKE w hoscie', () => {
        expect(domainLikePatterns('a_b.pl')[0]).toBe(String.raw`%://a\_b.pl%`);
    });

    it('dla pustego hosta nie daje wzorcow', () => {
        expect(domainLikePatterns('www.')).toEqual([]);
    });
});

describe('hostOfWebpage', () => {
    it('normalizuje host pelnego URL-a', () => {
        expect(hostOfWebpage('https://WWW.Kancelaria-Test.pl/kontakt')).toBe('kancelaria-test.pl');
    });

    it('radzi sobie z adresem bez schematu', () => {
        expect(hostOfWebpage('www.firma.pl/o-nas')).toBe('firma.pl');
    });

    it('dla tekstu, ktory nie jest adresem, zwraca null', () => {
        expect(hostOfWebpage('http://')).toBeNull();
    });
});

describe('pickByHost', () => {
    const rows = [
        { slug: 'xabc', webpage: 'https://xabc.pl' },
        { slug: 'podrobka', webpage: 'https://abc.pl.example.com' },
        { slug: 'bez-strony', webpage: null },
        { slug: 'abc-warszawa', webpage: 'https://www.abc.pl/warszawa' },
    ];

    it('wybiera wiersz z dokladnie tym samym hostem', () => {
        expect(pickByHost(rows, 'abc.pl')?.slug).toBe('abc-warszawa');
    });

    it('host z www i wielkimi literami pasuje po normalizacji', () => {
        expect(pickByHost(rows, 'WWW.ABC.pl')?.slug).toBe('abc-warszawa');
    });

    it('trafienie samego podciagu nie jest duplikatem', () => {
        expect(pickByHost(rows.slice(0, 3), 'abc.pl')).toBeNull();
    });
});
