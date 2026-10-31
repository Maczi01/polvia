import type { PremiumContentData } from './premium-content-schema';
import type { PreviousPremiumContent } from './upsert-premium-content';

/**
 * Czytelny diff tresci premium dla `db:premium --dry-run`: co sie zmieni w bazie.
 * Pozycje list porownywane po kluczu (plik zdjecia, polska nazwa/pytanie), wiec
 * poprawka tlumaczenia to `~`, a nie para `-`/`+`.
 */

type Keyed<T> = { label: string; items: readonly T[]; keyOf: (item: T) => string };

function diffList<T>(previous: Keyed<T>, next: readonly T[]): string[] {
    const before = new Map(
        previous.items.map(item => [previous.keyOf(item), JSON.stringify(item)]),
    );
    const after = new Map(next.map(item => [previous.keyOf(item), JSON.stringify(item)]));
    const lines: string[] = [];

    for (const [key, value] of after) {
        if (!before.has(key)) lines.push(`  + ${previous.label}: ${key}`);
        else if (before.get(key) !== value) lines.push(`  ~ ${previous.label}: ${key}`);
    }
    for (const key of before.keys()) {
        if (!after.has(key)) lines.push(`  - ${previous.label}: ${key}`);
    }

    const sameKeys =
        lines.length === 0 && [...before.keys()].join('\n') !== [...after.keys()].join('\n');
    if (sameKeys) lines.push(`  ~ ${previous.label}: zmieniona kolejnosc`);

    return lines;
}

function summary(content: PremiumContentData): string[] {
    return [
        `  szablon: ${content.template}`,
        `  cover: ${content.coverImage ?? 'brak'}`,
        `  galeria: ${content.gallery.length} zdjec`,
        `  cennik: ${content.priceList.length} pozycji`,
        `  FAQ: ${content.faq.length} pytan`,
    ];
}

function diffContent(previous: PremiumContentData, next: PremiumContentData): string[] {
    const lines: string[] = [];

    if (previous.template !== next.template) {
        lines.push(`  ~ szablon: ${previous.template} -> ${next.template}`);
    }
    if (previous.coverImage !== next.coverImage) {
        lines.push(`  ~ cover: ${previous.coverImage ?? 'brak'} -> ${next.coverImage ?? 'brak'}`);
    }

    return [
        ...lines,
        ...diffList(
            { label: 'galeria', items: previous.gallery, keyOf: item => item.file },
            next.gallery,
        ),
        ...diffList(
            { label: 'cennik', items: previous.priceList, keyOf: item => item.name.pl },
            next.priceList,
        ),
        ...diffList({ label: 'FAQ', items: previous.faq, keyOf: item => item.q.pl }, next.faq),
    ];
}

export function describePremiumChanges(
    previous: PreviousPremiumContent,
    next: PremiumContentData,
): string[] {
    if (previous.kind === 'none')
        return ['Nowa tresc premium (wpis nie mial jej w bazie):', ...summary(next)];

    if (previous.kind === 'invalid') {
        return [
            'Zapisana tresc nie przechodzi walidacji — zostanie w calosci nadpisana:',
            ...summary(next),
        ];
    }

    const lines = diffContent(previous.content, next);

    return lines.length === 0
        ? ['Bez zmian — tresc identyczna z zapisana w bazie.']
        : ['Zmiany wzgledem bazy:', ...lines];
}
