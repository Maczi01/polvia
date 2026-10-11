import 'server-only';

import { type CheerioAPI, load } from 'cheerio';

import { extractJsonLdFacts, type StructuredFacts } from './jsonld-facts';

export type { OpeningHours, StructuredAddress, StructuredFacts } from './jsonld-facts';

/**
 * Zamiana HTML strony firmy na material dla LLM (tekst) i fakty strukturalne
 * (JSON-LD, kandydaci logo, linki do podstrony kontaktowej). Czysta funkcja —
 * pobieranie HTML (i guard SSRF) to osobny modul.
 */

/** Okolo 12 tys. znakow: miesci stopke typowej strony, a nie rozdyma promptu. */
export const MAX_TEXT_LENGTH = 12_000;
export const MAX_CONTACT_LINKS = 2;

const STRIPPED_ELEMENTS = 'script, style, noscript, svg, iframe, template';
const CONTACT_PATTERN = /kontakt|contact|контакт/i;
const CONTACT_FALLBACK_PATHS = ['/kontakt', '/contact'];

const LOGO_SELECTORS = [
    'meta[property="og:image"], meta[property="og:image:url"], meta[name="og:image"]',
    'link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"]',
    'link[rel~="icon"]',
];

export interface PageExtraction {
    text: string;
    facts: StructuredFacts;
    /** Absolutne URL-e w kolejnosci og:image → apple-touch-icon → icon, bez duplikatow. */
    logoCandidates: string[];
    /** Najwyzej 2 absolutne URL-e podstron kontaktowych z tego samego originu. */
    contactLinks: string[];
}

export class HtmlExtractError extends Error {
    readonly code = 'INVALID_FINAL_URL';

    constructor(message: string) {
        super(message);
        this.name = 'HtmlExtractError';
    }
}

/**
 * @param finalUrl adres strony PO redirectach — wzgledem niego liczymy
 *   absolutne URL-e logo i linkow kontaktu.
 * @throws HtmlExtractError gdy `finalUrl` nie jest absolutnym URL-em http(s).
 */
export function extractPage(html: string, finalUrl: string): PageExtraction {
    const base = parseHttpUrl(finalUrl);
    if (!base) throw new HtmlExtractError('finalUrl musi byc absolutnym adresem http(s)');

    const $ = load(html);
    const jsonLdBlocks = $('script[type="application/ld+json"]')
        .toArray()
        .map(element => $(element).text());

    return {
        facts: extractJsonLdFacts(jsonLdBlocks),
        logoCandidates: extractLogoCandidates($, base),
        contactLinks: extractContactLinks($, base),
        // Ostatnie, bo usuwa elementy z drzewa (m.in. skrypty JSON-LD).
        text: extractText($),
    };
}

function parseHttpUrl(raw: string, base?: URL): URL | undefined {
    if (!URL.canParse(raw, base)) return undefined;
    const url = new URL(raw, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
}

function extractText($: CheerioAPI): string {
    $(STRIPPED_ELEMENTS).remove();
    // Spacja po kazdym elemencie, inaczej `<p>a</p><p>b</p>` zlepia sie w "ab".
    $('body *').append(' ');
    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH);
}

function extractLogoCandidates($: CheerioAPI, base: URL): string[] {
    const candidates = LOGO_SELECTORS.flatMap(selector =>
        $(selector)
            .toArray()
            .map(element => $(element).attr('content') ?? $(element).attr('href'))
            .filter(value => value !== undefined)
            .map(value => parseHttpUrl(value.trim(), base)?.href)
            .filter(value => value !== undefined),
    );
    return [...new Set(candidates)];
}

function extractContactLinks($: CheerioAPI, base: URL): string[] {
    const found = $('a[href]')
        .toArray()
        .filter(element => {
            const anchor = $(element);
            return (
                CONTACT_PATTERN.test(anchor.text()) ||
                CONTACT_PATTERN.test(anchor.attr('href') ?? '')
            );
        })
        .flatMap(element => parseHttpUrl($(element).attr('href') ?? '', base) ?? [])
        .filter(url => url.origin === base.origin)
        .map(url => withoutHash(url))
        .filter(href => href !== withoutHash(base));

    const unique = [...new Set(found)];
    if (unique.length > 0) return unique.slice(0, MAX_CONTACT_LINKS);

    return CONTACT_FALLBACK_PATHS.map(path => new URL(path, base.origin).href);
}

function withoutHash(url: URL): string {
    const copy = new URL(url.href);
    copy.hash = '';
    return copy.href;
}
