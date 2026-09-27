const EXACT_BELOW = 10;
const COARSE_FROM = 1000;

/**
 * Liczba do pokazania w statystykach: zaokraglona w dol, zeby nie zawyzac
 * i nie przeskakiwac po kazdym nowym wpisie (137 -> "130+", 2450 -> "2400+").
 */
export function formatDisplayCount(count: number): string {
    if (!Number.isFinite(count) || count <= 0) return '0';
    if (count < EXACT_BELOW) return String(Math.floor(count));

    const step = count < COARSE_FROM ? 10 : 100;
    return `${Math.floor(count / step) * step}+`;
}
