import { isCategory } from './category-contexts';

/**
 * Minimalne podobienstwo kosinusowe, ponizej ktorego wynik nie trafia do odpowiedzi.
 *
 * To **zapora na wejscie zdegenerowane, nie filtr trafnosci** — i ta roznica jest
 * tu istotna, bo poprzednia wartosc (0.8) brala sie z zalozenia, ze da sie progiem
 * oddzielic zapytania sensowne od bezsensownych. Nie da sie. Pomiar na zywej bazie
 * (269 lokalizacji, `text-embedding-3-small`):
 *
 *   zapytania trafne     top1 od 0.357 ("fryzjer") do 0.649 ("sklep z ukrainskimi produktami")
 *   zapytania bez sensu  top1 od 0.178 ("asdfghjkl qwerty") do 0.381 ("jak ugotowac ryz")
 *
 * Zakresy zachodza na siebie, wiec zaden prog nie rozdziela ich czysto — sprawdzone
 * takze dla z-score wzgledem rozkladu dla danego zapytania i dla ilorazu top1/srednia;
 * obie metryki daly margines ujemny. 0.8 bylo nieosiagalne dla czegokolwiek, wiec
 * endpoint zwracal pusta liste na KAZDE zapytanie.
 *
 * 0.3 przepuszcza wszystkie zmierzone zapytania trafne i odcina te zdegenerowane
 * (losowe znaki, pytania spoza domeny katalogu). Zapytania z odlegla, ale prawdziwa
 * zbieznoscia tematyczna przejda — na to prog jest zlym narzedziem i trzeba innego
 * mechanizmu (np. bramki leksykalnej przed semantyka).
 *
 * Podnoszac te wartosc sprawdz najpierw, ile wynosi top1 dla "fryzjer".
 */
export const RELEVANCE_FLOOR = 0.3;

export type ScoredCandidate = {
    name: string;
    category: string;
    relevanceScore: number;
};

/**
 * Mnoznik premiujacy wynik, ktory dodatkowo trafia w kategorie i w nazwe.
 * Wplywa wylacznie na kolejnosc — o wejsciu do wynikow decyduje `RELEVANCE_FLOOR`
 * liczony na surowym podobienstwie, zeby premia nie przepychala slabego wyniku
 * ponad prog.
 */
export function calculateRelevanceBoost(
    candidate: ScoredCandidate,
    query: string,
    category?: string | null,
): number {
    let boost = 1;

    if (isCategory(category) && candidate.category === category) {
        boost += 0.3;
    }

    const queryTerms = query
        .toLowerCase()
        .split(' ')
        .filter(term => term.length > 0);

    if (queryTerms.length === 0) {
        return boost;
    }

    const serviceName = candidate.name.toLowerCase();
    const matchingTerms = queryTerms.filter(term => serviceName.includes(term));

    return boost + (matchingTerms.length / queryTerms.length) * 0.2;
}

/**
 * Odsiewa wyniki ponizej progu, ustawia je wedlug wyniku z premia i przycina do `limit`.
 */
export function selectRelevant<T extends ScoredCandidate>(
    candidates: T[],
    query: string,
    category: string | null | undefined,
    limit: number,
): (T & { boostedScore: number })[] {
    if (limit <= 0) {
        return [];
    }

    return candidates
        .filter(candidate => candidate.relevanceScore >= RELEVANCE_FLOOR)
        .map(candidate => ({
            ...candidate,
            boostedScore: candidate.relevanceScore * calculateRelevanceBoost(candidate, query, category),
        }))
        .sort((a, b) => b.boostedScore - a.boostedScore)
        .slice(0, limit);
}
