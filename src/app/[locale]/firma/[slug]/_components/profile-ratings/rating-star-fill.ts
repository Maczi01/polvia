/**
 * Ile procent gwiazdki na pozycji `position` (od 1) wypelnia ocena: 4,6 to cztery pelne
 * i piata w 60%. Zaokraglone do pelnego procenta, bo idzie prosto do szerokosci w CSS.
 */
export function getStarFillPercent(rating: number, position: number): number {
    const fill = Math.min(Math.max(rating - (position - 1), 0), 1);
    return Math.round(fill * 100);
}
