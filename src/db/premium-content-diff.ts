import type { PremiumContentData } from './premium-content-schema';
import type { PreviousPremiumContent } from './upsert-premium-content';

/**
 * Czytelny diff tresci premium dla `db:premium --dry-run`: co sie zmieni w bazie.
 * Pozycje list porownywane po kluczu (plik zdjecia, polska nazwa/pytanie), wiec
 * poprawka tlumaczenia to `~`, a nie para `-`/`+`.
 */

/** Lista do porownania: etykieta w diffie i klucz pozycji, wspolny dla obu stron. */
type ListDiff<T> = { label: string; keyOf: (item: T) => string };

function diffList<T>(
    { label, keyOf }: ListDiff<T>,
    previous: readonly T[],
    next: readonly T[],
): string[] {
    const before = new Map(previous.map(item => [keyOf(item), JSON.stringify(item)]));
    const after = new Map(next.map(item => [keyOf(item), JSON.stringify(item)]));
    const lines: string[] = [];

    for (const [key, value] of after) {
        if (!before.has(key)) lines.push(`  + ${label}: ${key}`);
        else if (before.get(key) !== value) lines.push(`  ~ ${label}: ${key}`);
    }
    for (const key of before.keys()) {
        if (!after.has(key)) lines.push(`  - ${label}: ${key}`);
    }

    const isOnlyReordered =
        lines.length === 0 && [...before.keys()].join('\n') !== [...after.keys()].join('\n');
    if (isOnlyReordered) lines.push(`  ~ ${label}: zmieniona kolejnosc`);

    return lines;
}

/** Premium reczne: ostatni dzien wlacznie, czas polski (`manual-premium.ts`). */
function manualPremiumLabel(activeUntil: string | undefined): string {
    return activeUntil === undefined ? 'brak' : `do ${activeUntil} wlacznie (Europe/Warsaw)`;
}

function summary(content: PremiumContentData): string[] {
    return [
        `  premium reczne: ${manualPremiumLabel(content.activeUntil)}`,
        `  szablon: ${content.template}`,
        `  cover: ${content.coverImage ?? 'brak'}`,
        `  galeria: ${content.gallery.length} zdjec`,
        `  cennik: ${content.priceList.length} pozycji`,
        `  FAQ: ${content.faq.length} pytan`,
    ];
}

function diffContent(previous: PremiumContentData, next: PremiumContentData): string[] {
    const lines: string[] = [];

    if (previous.activeUntil !== next.activeUntil) {
        lines.push(
            `  ~ premium reczne: ${manualPremiumLabel(previous.activeUntil)} -> ${manualPremiumLabel(next.activeUntil)}`,
        );
    }
    if (previous.template !== next.template) {
        lines.push(`  ~ szablon: ${previous.template} -> ${next.template}`);
    }
    if (previous.coverImage !== next.coverImage) {
        lines.push(`  ~ cover: ${previous.coverImage ?? 'brak'} -> ${next.coverImage ?? 'brak'}`);
    }

    return [
        ...lines,
        ...diffList(
            { label: 'galeria', keyOf: item => item.file },
            previous.gallery,
            next.gallery,
        ),
        ...diffList(
            { label: 'cennik', keyOf: item => item.name.pl },
            previous.priceList,
            next.priceList,
        ),
        ...diffList({ label: 'FAQ', keyOf: item => item.q.pl }, previous.faq, next.faq),
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
