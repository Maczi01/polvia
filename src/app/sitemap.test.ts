import sitemap from '@/app/sitemap';
import { CATEGORY_SLUGS, COUNTY_SLUGS } from '@/lib/slug-mappings';

// getPosts czyta pliki MDX z dysku — zewnetrzne zrodlo tresci, nieistotne dla
// tego testu. Mock czyni wynik deterministycznym.
jest.mock('@/lib/posts', () => ({
    getPosts: jest.fn().mockResolvedValue([]),
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
