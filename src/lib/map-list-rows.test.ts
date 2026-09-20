import {
    buildListRows,
    findCardIndex,
    findCollapsedGroupKey,
    findRowIndex,
    onlineHeaderRowIndex,
} from '@/lib/map-list-rows';
import type { PartialService } from '@/types';

let counter = 0;

function service(name = 'Usluga'): PartialService {
    counter += 1;
    return { id: `id-${counter}`, serviceId: `svc-${counter}`, name } as PartialService;
}

function services(count: number): PartialService[] {
    return Array.from({ length: count }, () => service());
}

describe('buildListRows', () => {
    it('buduje same karty, gdy sa tylko wyniki glowne', () => {
        const main = services(3);

        const rows = buildListRows({ main, online: [], embedding: [], isLoadingEmbeddings: false });

        expect(rows).toHaveLength(3);
        expect(rows.every(row => row.kind === 'card' && row.section === 'main')).toBe(true);
    });

    it('nadaje kartom ciagly cardIndex, pomijajac naglowki', () => {
        const rows = buildListRows({
            main: services(2),
            online: services(2),
            embedding: [],
            isLoadingEmbeddings: false,
        });

        const cardIndexes = rows.filter(row => row.kind === 'card').map(row => row.cardIndex);

        expect(cardIndexes).toEqual([0, 1, 2, 3]);
    });

    it('naglowki nie maja cardIndex', () => {
        const rows = buildListRows({
            main: services(1),
            online: services(1),
            embedding: [],
            isLoadingEmbeddings: false,
        });

        expect(rows.filter(row => row.kind !== 'card').every(row => row.cardIndex === null)).toBe(true);
    });

    it('wstawia EmptyState, gdy nie ma wynikow glownych', () => {
        const rows = buildListRows({ main: [], online: [], embedding: [], isLoadingEmbeddings: false });

        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe('empty');
    });

    /**
     * Sedno refaktoru. Dzis `scrollToIndex` dostaje JEDEN numer, a uzywa go raz
     * jako indeksu w `cardRefs` (same karty), a raz jako indeksu dziecka `VList`
     * (karty ORAZ naglowki). Dla kart online te dwa numery sie rozjezdzaja o
     * liczbe naglowkow stojacych wyzej — i to jest blad, ktory ten model usuwa.
     */
    it('rozroznia indeks wiersza od indeksu karty dla sekcji online', () => {
        const main = services(2);
        const online = services(1);
        const rows = buildListRows({ main, online, embedding: [], isLoadingEmbeddings: false });

        const kartaOnline = online[0];

        // W cardRefs to trzecia karta (indeks 2)...
        expect(findCardIndex(rows, kartaOnline.id)).toBe(2);
        // ...ale w dzieciach VList stoi za naglowkiem sekcji, wiec ma indeks 3.
        expect(findRowIndex(rows, kartaOnline.id)).toBe(3);
    });

    it('naglowek online stoi dokladnie za kartami glownymi', () => {
        const rows = buildListRows({
            main: services(5),
            online: services(2),
            embedding: [],
            isLoadingEmbeddings: false,
        });

        expect(onlineHeaderRowIndex(rows)).toBe(5);
    });

    it('sekcja embedding dostaje wlasny naglowek', () => {
        const rows = buildListRows({
            main: services(1),
            online: [],
            embedding: services(2),
            isLoadingEmbeddings: false,
        });

        expect(rows.map(row => row.kind)).toEqual(['card', 'embeddingHeader', 'card', 'card']);
    });

    it('szkielet ladowania pojawia sie tylko przy istniejacych wynikach glownych', () => {
        const zWynikami = buildListRows({
            main: services(1),
            online: [],
            embedding: [],
            isLoadingEmbeddings: true,
        });
        const bezWynikow = buildListRows({
            main: [],
            online: [],
            embedding: [],
            isLoadingEmbeddings: true,
        });

        expect(zWynikami.some(row => row.kind === 'loading')).toBe(true);
        expect(bezWynikow.some(row => row.kind === 'loading')).toBe(false);
    });

    it('nie powtarza kluczy', () => {
        const rows = buildListRows({
            main: services(3),
            online: services(2),
            embedding: services(2),
            isLoadingEmbeddings: true,
        });

        const keys = rows.map(row => row.key);

        expect(new Set(keys).size).toBe(keys.length);
    });

    it('oddaje -1 dla uslugi spoza listy', () => {
        const rows = buildListRows({ main: services(2), online: [], embedding: [], isLoadingEmbeddings: false });

        expect(findRowIndex(rows, 'nie-ma-takiej')).toBe(-1);
        expect(findCardIndex(rows, 'nie-ma-takiej')).toBe(-1);
    });
});

/**
 * Zwijanie firm wielooddzialowych. Klucz konstrukcji: rozwinieta grupa emituje
 * ZWYKLE wiersze `card`, wiec `cardIndex`, `cardRefs` i przewijanie dzialaja bez
 * zmian — rozwiniecie tylko wstawia wiersze, nie tworzy nowej numeracji.
 */
describe('buildListRows — grupowanie firm wielooddzialowych', () => {
    function company(serviceId: string, count: number): PartialService[] {
        return Array.from({ length: count }, (_, i) => {
            counter += 1;
            return {
                id: `${serviceId}-loc-${i}`,
                serviceId,
                name: serviceId,
                city: `Miasto ${i}`,
            } as PartialService;
        });
    }

    it('zwija firme powyzej progu do jednego wiersza', () => {
        const rows = buildListRows({
            main: company('best-market', 4),
            online: [],
            embedding: [],
            isLoadingEmbeddings: false,
            expandedGroups: new Set(),
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe('group');
    });

    it('zwinieta grupa nie emituje zadnych kart', () => {
        const rows = buildListRows({
            main: company('best-market', 4),
            online: [],
            embedding: [],
            isLoadingEmbeddings: false,
            expandedGroups: new Set(),
        });

        expect(rows.filter(row => row.kind === 'card')).toHaveLength(0);
    });

    it('rozwinieta grupa emituje karty swoich czlonkow', () => {
        const rows = buildListRows({
            main: company('best-market', 4),
            online: [],
            embedding: [],
            isLoadingEmbeddings: false,
            expandedGroups: new Set(['main-group-best-market']),
        });

        expect(rows[0].kind).toBe('group');
        expect(rows.filter(row => row.kind === 'card')).toHaveLength(4);
    });

    it('numeracja kart pozostaje ciagla mimo wierszy grupy', () => {
        const rows = buildListRows({
            main: [...company('alfa', 1), ...company('best-market', 3), ...company('beta', 1)],
            online: [],
            embedding: [],
            isLoadingEmbeddings: false,
            expandedGroups: new Set(['main-group-best-market']),
        });

        const cardIndexes = rows.filter(row => row.kind === 'card').map(row => row.cardIndex);

        expect(cardIndexes).toEqual([0, 1, 2, 3, 4]);
    });

    // Klik w pin lokalizacji schowanej w zwinietej grupie musi najpierw te grupe
    // rozwinac — bez tego kazdy link `?place=` do oddzialu duzej firmy bylby martwy.
    it('wskazuje grupe, w ktorej schowana jest lokalizacja', () => {
        const members = company('best-market', 4);
        const rows = buildListRows({
            main: members,
            online: [],
            embedding: [],
            isLoadingEmbeddings: false,
            expandedGroups: new Set(),
        });

        expect(findCollapsedGroupKey(rows, members[2].id)).toBe('main-group-best-market');
        expect(findRowIndex(rows, members[2].id)).toBe(-1);
    });

    it('po rozwinieciu lokalizacja przestaje byc schowana', () => {
        const members = company('best-market', 4);
        const rows = buildListRows({
            main: members,
            online: [],
            embedding: [],
            isLoadingEmbeddings: false,
            expandedGroups: new Set(['main-group-best-market']),
        });

        expect(findCollapsedGroupKey(rows, members[2].id)).toBeNull();
        expect(findRowIndex(rows, members[2].id)).toBeGreaterThan(-1);
    });

    it('sekcja online tez grupuje — hybrid ma wiele punktow', () => {
        const rows = buildListRows({
            main: [],
            online: company('slowianoczka', 8),
            embedding: [],
            isLoadingEmbeddings: false,
            expandedGroups: new Set(),
        });

        expect(rows.filter(row => row.kind === 'group')).toHaveLength(1);
    });
});
