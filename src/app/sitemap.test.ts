import sitemap from '@/app/sitemap';
import { getServiceProfileSitemapEntries } from '@/lib/service-profile-queries';
import { CATEGORY_SLUGS, COUNTY_SLUGS } from '@/lib/slug-mappings';

// getPosts czyta pliki MDX z dysku — zewnetrzne zrodlo tresci, nieistotne dla
// tego testu. Mock czyni wynik deterministycznym.
jest.mock('@/lib/posts', () => ({
    getPosts: jest.fn().mockResolvedValue([]),
}));

// env.ts laduje @t3-oss/env-nextjs, ktory jest wylacznie ESM i nie ma buildu CJS
// do podpiecia przez moduleNameMapper. Zmienne srodowiskowe to zewnetrzne wejscie,
// wiec podajemy je jawnie — asercje sprawdzaja sciezki, nie domene.
jest.mock('../../env', () => ({
    env: { NEXT_PUBLIC_SITE_URL: 'https://polvia.test' },
}));

// Baza to zewnetrzny serwis. Filtr aktywnych wpisow ze slugiem siedzi w SQL zapytania
// (test w `service-profile-queries.test.ts`); tu liczy sie, ze sitemapa nie dokleja nic poza nim.
jest.mock('@/lib/service-profile-queries', () => ({
    getServiceProfileSitemapEntries: jest.fn().mockResolvedValue([]),
}));

const urls = async (): Promise<string[]> => (await sitemap()).map(entry => String(entry.url));

describe('sitemap — trasa uslug online', () => {
    it('zawiera /mapa/online i /en/map/online', async () => {
        const list = await urls();

        expect(list.some(url => url.endsWith('/mapa/online'))).toBe(true);
        expect(list.some(url => url.endsWith('/en/map/online'))).toBe(true);
    });

    it('NIE zawiera kombinacji kategoria + online', async () => {
        const list = await urls();

        // Granica scope'u: 14 kategorii x 2 locale to thin content, dopoki
        // wiekszosc kategorii ma zero uslug zdalnych.
        const kombinacje = list.filter(url => /\/(mapa|map)\/[^/]+\/online$/.test(url));

        expect(kombinacje).toEqual([]);
    });

    it('nie zawiera duplikatow URL-i', async () => {
        const list = await urls();

        expect(new Set(list).size).toBe(list.length);
    });

    it('wpis online ma metadane jak pozostale trasy mapy', async () => {
        const entries = await sitemap();
        const online = entries.find(entry => String(entry.url).endsWith('/mapa/online'));

        expect(online).toBeDefined();
        expect(online?.changeFrequency).toBe('weekly');
        expect(online?.lastModified).toBeDefined();
    });

    describe('regresje na istniejacych trasach', () => {
        it('zachowuje strony glowne i mape', async () => {
            const list = await urls();

            expect(list.some(url => url.endsWith('/mapa'))).toBe(true);
            expect(list.some(url => url.endsWith('/en/map'))).toBe(true);
        });

        it('zachowuje wszystkie kategorie w pl i en', async () => {
            const list = await urls();

            for (const slug of Object.values(CATEGORY_SLUGS.pl)) {
                expect(list.some(url => url.endsWith(`/mapa/${slug}`))).toBe(true);
            }
            for (const slug of Object.values(CATEGORY_SLUGS.en)) {
                expect(list.some(url => url.endsWith(`/en/map/${slug}`))).toBe(true);
            }
        });

        it('zachowuje wszystkie wojewodztwa', async () => {
            const list = await urls();

            for (const county of COUNTY_SLUGS) {
                expect(list.some(url => url.endsWith(`/mapa/${county}`))).toBe(true);
            }
        });

        it('utrzymuje konwencje: kategorie tylko w pl i en, bez ru i uk', async () => {
            const list = await urls();

            expect(list.some(url => url.includes('/ru/map/'))).toBe(false);
            expect(list.some(url => url.includes('/uk/map/'))).toBe(false);
        });
    });
});

describe('sitemap — strona „Dodaj firme"', () => {
    it('zawiera /dodaj-firme i /en/add-business', async () => {
        const list = await urls();

        expect(list).toContain('https://polvia.test/dodaj-firme');
        expect(list).toContain('https://polvia.test/en/add-business');
    });
});

describe('sitemap — profile firm', () => {
    const UPDATED_AT = new Date('2026-10-30T12:00:00Z');

    beforeEach(() => {
        jest.mocked(getServiceProfileSitemapEntries).mockResolvedValue([
            { slug: 'kancelaria-nowak', updatedAt: UPDATED_AT },
        ]);
    });

    afterEach(() => {
        jest.mocked(getServiceProfileSitemapEntries).mockResolvedValue([]);
        jest.restoreAllMocks();
    });

    it('zawiera profil w 4 wariantach locale, pl bez prefiksu', async () => {
        const list = await urls();

        expect(list).toContain('https://polvia.test/firma/kancelaria-nowak');
        expect(list).toContain('https://polvia.test/en/firma/kancelaria-nowak');
        expect(list).toContain('https://polvia.test/ru/firma/kancelaria-nowak');
        expect(list).toContain('https://polvia.test/uk/firma/kancelaria-nowak');
    });

    it('lastModified profilu to data aktualizacji wpisu', async () => {
        const entries = await sitemap();
        const profile = entries.find(entry => entry.url === 'https://polvia.test/firma/kancelaria-nowak');

        expect(profile?.lastModified).toBe(UPDATED_AT.toISOString());
    });

    it('zawiera tylko profile zwrocone przez zapytanie o aktywne wpisy', async () => {
        const list = await urls();

        const profiles = list.filter(url => url.includes('/firma/'));
        expect(profiles).toHaveLength(4);
        expect(profiles.every(url => url.endsWith('/firma/kancelaria-nowak'))).toBe(true);
    });

    it('awaria bazy rzuca blad zamiast zwracac sitemape bez profili', async () => {
        // Pusty wynik trafilby do ISR na godzine; blad zostawia poprzednia wersje.
        jest.mocked(getServiceProfileSitemapEntries).mockRejectedValue(new Error('connection refused'));

        await expect(sitemap()).rejects.toThrow('connection refused');
    });
});
