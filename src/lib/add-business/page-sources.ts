import 'server-only';

import {
    CONTACT_FALLBACK_PATHS,
    extractPage,
    HtmlExtractError,
    MAX_TEXT_LENGTH,
    type PageExtraction,
} from '@/lib/add-business/html-extract';
import { mergeFacts, type StructuredFacts } from '@/lib/add-business/jsonld-facts';
import {
    SAFE_FETCH_TIMEOUT_MS,
    type SafeFetchErrorCode,
    type SafeFetchResult,
} from '@/lib/add-business/safe-fetch';

/**
 * Material zrodlowy dla LLM: strona glowna + najwyzej 2 podstrony kontaktowe (R3), w jednym
 * budzecie czasu (review A, P2 #9).
 *
 * Podstrony wychodza z HTML-a strony glownej, wiec nie da sie ich pobrac rownolegle z nia —
 * dwa pelne timeouty po 8 s plus LLM 30 s nie mieszcza sie w `maxDuration = 60`. Dlatego
 * wolajacy podaje jeden termin (`fetchDeadline`), a kazdy fetch dostaje `timeoutMs` z czasu,
 * ktory do niego zostal. Podstrony sa dodatkiem: gdy budzetu brakuje, pomijamy je.
 */

/** Krotszy limit dla podstron: fakty sa zwykle i na stronie glownej. */
export const SUBPAGE_TIMEOUT_MS = 4000;
/** Zgadywane `/kontakt` i `/contact` czesto nie istnieja — nie czekamy na nie dlugo. */
export const FALLBACK_SUBPAGE_TIMEOUT_MS = 2000;
/** Ponizej tego fetch nie ma sensu (sam TLS handshake potrafi tyle trwac). */
export const MIN_FETCH_TIMEOUT_MS = 1000;
/** Podstrona kontaktowa wnosi glownie stopke z danymi — reszta budzetu tekstu idzie na glowna. */
const SUBPAGE_TEXT_LENGTH = Math.floor(MAX_TEXT_LENGTH / 4);

export type FetchHtml = (
    url: string,
    options: { timeoutMs: number },
) => Promise<SafeFetchResult<string>>;

export interface PageSourceDeps {
    fetchHtml: FetchHtml;
    now: () => number;
    /** Moment (wg `now`), po ktorym nie zaczynamy juz zadnego fetcha. */
    fetchDeadline: number;
}

export interface PageSource {
    /** Adres strony glownej po redirectach. */
    url: string;
    text: string;
    structured: StructuredFacts;
    logoCandidate: string | null;
}

export type PageSourceResult =
    | { ok: true; source: PageSource }
    | { ok: false; code: SafeFetchErrorCode };

function timeLeft(deps: PageSourceDeps): number {
    return deps.fetchDeadline - deps.now();
}

/** `finalUrl` z safe-fetch jest zawsze absolutnym http(s), wiec blad tu to zly adres zrodla. */
function extractOrNull(html: string, finalUrl: string): PageExtraction | null {
    try {
        return extractPage(html, finalUrl);
    } catch (error) {
        if (!(error instanceof HtmlExtractError)) throw error;
        console.warn('add-business page skipped', { code: error.code });
        return null;
    }
}

function isFallbackLink(link: string): boolean {
    return CONTACT_FALLBACK_PATHS.includes(new URL(link).pathname);
}

async function fetchSubpages(links: string[], deps: PageSourceDeps): Promise<PageExtraction[]> {
    const available = timeLeft(deps);
    const planned = links
        .map(link => {
            const cap = isFallbackLink(link) ? FALLBACK_SUBPAGE_TIMEOUT_MS : SUBPAGE_TIMEOUT_MS;
            return { link, timeoutMs: Math.min(cap, available) };
        })
        .filter(plan => plan.timeoutMs >= MIN_FETCH_TIMEOUT_MS);

    const settled = await Promise.allSettled(
        planned.map(plan => deps.fetchHtml(plan.link, { timeoutMs: plan.timeoutMs })),
    );

    return settled.flatMap(outcome => {
        if (outcome.status === 'rejected') {
            console.warn('add-business subpage failed', { reason: 'exception' });
            return [];
        }
        if (!outcome.value.ok) return [];
        return extractOrNull(outcome.value.body, outcome.value.finalUrl) ?? [];
    });
}

function combine(url: string, main: PageExtraction, subpages: PageExtraction[]): PageSource {
    const subTexts = subpages.map(page => page.text.slice(0, SUBPAGE_TEXT_LENGTH));
    const subLength = subTexts.reduce((sum, text) => sum + text.length, 0);
    const mainText = main.text.slice(0, Math.max(0, MAX_TEXT_LENGTH - subLength));

    return {
        url,
        text: [mainText, ...subTexts].filter(text => text !== '').join('\n\n'),
        // Strona glowna pierwsza: jej JSON-LD wygrywa z JSON-LD podstron.
        structured: mergeFacts([main.facts, ...subpages.map(page => page.facts)]),
        logoCandidate: main.logoCandidates[0] ?? null,
    };
}

export async function readPageSource(url: string, deps: PageSourceDeps): Promise<PageSourceResult> {
    const mainTimeout = Math.min(SAFE_FETCH_TIMEOUT_MS, timeLeft(deps));
    if (mainTimeout < MIN_FETCH_TIMEOUT_MS) return { ok: false, code: 'TIMEOUT' };

    const fetched = await deps.fetchHtml(url, { timeoutMs: mainTimeout });
    if (!fetched.ok) return fetched;

    const main = extractOrNull(fetched.body, fetched.finalUrl);
    if (main === null) return { ok: false, code: 'INVALID_URL' };

    const subpages = await fetchSubpages(main.contactLinks, deps);
    return { ok: true, source: combine(fetched.finalUrl, main, subpages) };
}
