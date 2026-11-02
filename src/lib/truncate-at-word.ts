const ELLIPSIS = '…';

/**
 * Tekst obciety na granicy slowa z wielokropkiem; biale znaki zwiniete do spacji.
 * Pojedyncze slowo dluzsze niz limit jest ciete twardo.
 */
export function truncateAtWord(text: string, maxLength: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;

    const room = normalized.slice(0, maxLength - ELLIPSIS.length);
    const lastSpace = room.lastIndexOf(' ');
    const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room;
    return `${cut.replace(/[\s,.;:!?—–-]+$/, '')}${ELLIPSIS}`;
}
