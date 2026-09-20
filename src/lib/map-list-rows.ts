import { groupServicesByCompany, type ServiceRow } from '@/lib/group-services-by-company';
import type { PartialService } from '@/types';

/**
 * Jawny model wierszy listy przy mapie.
 *
 * Powod istnienia: lista ma dzis DWIE rownolegle numeracje, ktore musza sie
 * zgadzac, a nic tego nie pilnuje poza komentarzem w kodzie.
 *
 * - `cardRefs` i `allServices` licza SAME KARTY,
 * - `virtua` liczy WSZYSTKIE dzieci `VList`, czyli karty ORAZ naglowki sekcji.
 *
 * `scrollToIndex` dostaje jeden numer i uzywa go raz jako jednego, raz jako
 * drugiego (mobile idzie po `cardRefs`, desktop po `VList`). Dla sekcji online
 * i embedding te numery roznia sie o liczbe naglowkow stojacych wyzej.
 *
 * Model liczy oba indeksy raz i z jednego zrodla, wiec rozjechanie sie ich
 * przestaje byc mozliwe. Jest tez warunkiem wstepnym zwijania firm
 * wielooddzialowych: tam liczba wierszy zmienia sie w trakcie dzialania, a
 * arytmetyka na `frontendFilteredServices.length` przestaje cokolwiek znaczyc.
 */

export type ListRowKind =
    | 'card'
    | 'group'
    | 'onlineHeader'
    | 'embeddingHeader'
    | 'empty'
    | 'loading';

export type ListSection = 'main' | 'online' | 'embedding';

export interface ListRow {
    key: string;
    kind: ListRowKind;
    /** Pozycja wsrod SAMYCH kart (`cardRefs`). `null` dla naglowkow i wierszy grupy. */
    cardIndex: number | null;
    section: ListSection;
    service?: PartialService;
    /** Wypelnione tylko dla `kind === 'group'`. */
    group?: Extract<ServiceRow, { kind: 'group' }>;
    /** Czy wiersz grupy jest rozwiniety. */
    isExpanded?: boolean;
}

export interface ListRowsInput {
    main: PartialService[];
    online: PartialService[];
    embedding: PartialService[];
    isLoadingEmbeddings: boolean;
    /** Klucze grup rozwinietych przez uzytkownika. Domyslnie wszystkie zwiniete. */
    expandedGroups?: ReadonlySet<string>;
}

/**
 * Kolejnosc MUSI odpowiadac kolejnosci renderowania w `map-list.tsx`. To jedyne
 * miejsce, w ktorym ta kolejnosc jest zapisana — renderer ma po niej iterowac,
 * a nie budowac wlasnej.
 */
export function buildListRows({
    main,
    online,
    embedding,
    isLoadingEmbeddings,
    expandedGroups = new Set<string>(),
}: ListRowsInput): ListRow[] {
    const rows: ListRow[] = [];
    let cardIndex = 0;

    const pushCard = (service: PartialService, section: ListSection): void => {
        rows.push({
            key: `${section}-${service.id}`,
            kind: 'card',
            cardIndex: cardIndex++,
            section,
            service,
        });
    };

    /**
     * Rozwinieta grupa emituje ZWYKLE wiersze `card`. Dzieki temu `cardIndex`,
     * `cardRefs` i przewijanie nie wiedza o istnieniu grup — rozwiniecie tylko
     * wstawia wiersze w istniejaca numeracje.
     */
    const pushSection = (services: PartialService[], section: ListSection): void => {
        for (const row of groupServicesByCompany(services)) {
            if (row.kind === 'single') {
                pushCard(row.service, section);
                continue;
            }

            // Jeden klucz sluzy i Reactowi, i stanowi rozwiniecia. Prefiks sekcji
            // sprawia, ze ta sama firma w dwoch sekcjach rozwija sie niezaleznie.
            const key = `${section}-${row.key}`;
            const isExpanded = expandedGroups.has(key);
            rows.push({
                key,
                kind: 'group',
                cardIndex: null,
                section,
                group: row,
                isExpanded,
            });

            if (isExpanded) {
                for (const member of row.services) pushCard(member, section);
            }
        }
    };

    pushSection(main, 'main');

    if (main.length === 0) {
        rows.push({ key: 'no-main-results', kind: 'empty', cardIndex: null, section: 'main' });
    }

    if (online.length > 0) {
        rows.push({ key: 'online-header', kind: 'onlineHeader', cardIndex: null, section: 'online' });
        pushSection(online, 'online');
    }

    if (embedding.length > 0) {
        rows.push({
            key: 'embedding-header',
            kind: 'embeddingHeader',
            cardIndex: null,
            section: 'embedding',
        });
        pushSection(embedding, 'embedding');
    }

    // Szkielet tylko przy istniejacych wynikach glownych — inaczej dubluje
    // komunikat EmptyState, ktory sam informuje o trwajacym szukaniu.
    if (isLoadingEmbeddings && main.length > 0) {
        rows.push({ key: 'loading-embeddings', kind: 'loading', cardIndex: null, section: 'embedding' });
    }

    return rows;
}

/** Pozycja wsrod dzieci `VList` — numer dla `virtuaListRef.scrollToIndex`. */
export function findRowIndex(rows: ListRow[], serviceId: string): number {
    return rows.findIndex(row => row.service?.id === serviceId);
}

/** Pozycja wsrod samych kart — numer dla `cardRefs`. */
export function findCardIndex(rows: ListRow[], serviceId: string): number {
    const row = rows.find(r => r.service?.id === serviceId);

    return row?.cardIndex ?? -1;
}

/** Pozycja naglowka sekcji online wsrod dzieci `VList`, albo -1 gdy sekcji nie ma. */
export function onlineHeaderRowIndex(rows: ListRow[]): number {
    return rows.findIndex(row => row.kind === 'onlineHeader');
}

/**
 * Klucz wiersza grupy, w ktorej schowana jest lokalizacja — albo `null`, gdy
 * lokalizacja jest widoczna. Klik w pin albo wejscie z `?place=` musi najpierw
 * rozwinac te grupe, inaczej nie ma do czego przewinac.
 */
export function findCollapsedGroupKey(rows: ListRow[], serviceId: string): string | null {
    for (const row of rows) {
        if (row.kind !== 'group' || row.isExpanded) continue;
        if (row.group?.services.some(service => service.id === serviceId)) return row.key;
    }

    return null;
}
