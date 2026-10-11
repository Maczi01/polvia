import 'server-only';

import { z } from 'zod';

import type { Locale } from '@/i18n/config';
import { withActionBoundary } from '@/lib/add-business/action-errors';
import type { BusinessDraft } from '@/lib/add-business/draft-schema';
import { type Geocode, geocodeToDraftGeo } from '@/lib/add-business/draft-geo';
import { type DraftGeo, saveDraft, type StoredDraft } from '@/lib/add-business/draft-store';
import type { GeoPoint } from '@/lib/add-business/geocode';
import { classifyLink } from '@/lib/add-business/link-kind';
import {
    consumeFetchLimit,
    consumeGenerationLimit,
    peekGenerationLimit,
} from '@/lib/add-business/limits';
import {
    type DraftClient,
    DRAFT_TIMEOUT_MS,
    fromOwner,
    fromPage,
} from '@/lib/add-business/llm-draft';
import { parseManualInput } from '@/lib/add-business/manual-input-schema';
import { OWNER_EDIT_ERRORS } from '@/lib/add-business/owner-edits-schema';
import { type FetchHtml, type PageSource, readPageSource } from '@/lib/add-business/page-sources';
import { buildPreview, toPin } from '@/lib/add-business/preview';
import {
    type GenerateDraftResult,
    type ManualReason,
    SAFE_FETCH_ERROR_TO_MANUAL,
} from '@/lib/add-business/types';
import {
    buildServiceUrl,
    localePathPrefix,
    localizeMapPath,
    stringifyMapUrl,
} from '@/lib/map-url-builder';
import type { DomainMatch } from '@/lib/queries';
import type { RateLimitResult } from '@/lib/rate-limit';

/**
 * Orkiestrator kroku 1 (link albo tryb reczny) → szkic w Redisie + dane podgladu.
 *
 * Uslugi zewnetrzne (strona firmy, OpenAI, Nominatim, baza katalogu, zegar) przychodza
 * w `deps`, zeby testy nie dotykaly sieci. Limity i szkic ida przez Redis (`@/lib/redis`).
 *
 * Budzet czasu (review A, P2 #9): strona ma `maxDuration = 60`. Calosc miescimy w
 * `GENERATION_BUDGET_MS` (zapas na cold start), z czego koniec rezerwujemy na LLM
 * i geokodowanie — fetche dostaja tylko to, co zostaje przed `fetchDeadline`.
 */

export const GENERATION_BUDGET_MS = 50_000;
/** Najgorszy przypadek geokodowania: oczekiwanie na blokade 1 req/s + fetch Nominatim 8 s. */
export const GEOCODE_RESERVE_MS = 9500;
/** Od startu: po tym czasie nie zaczynamy zadnego fetcha strony. */
export const FETCH_BUDGET_MS = GENERATION_BUDGET_MS - DRAFT_TIMEOUT_MS - GEOCODE_RESERVE_MS;

export interface GenerateDraftDeps {
    llm: DraftClient;
    fetchHtml: FetchHtml;
    geocode: Geocode;
    findDuplicate: (host: string, locale: Locale) => Promise<DomainMatch | null>;
    now: () => number;
}

export interface ActionRequest {
    formData: FormData;
    ip: string;
    locale: Locale;
}

const URL_MAX_LENGTH = 2048;
const modeSchema = z.enum(['link', 'manual']);
const urlSchema = z.string().trim().min(1).max(URL_MAX_LENGTH);

type Outcome = Promise<GenerateDraftResult>;

function invalidUrl(): GenerateDraftResult {
    return { status: 'invalid', fieldErrors: { url: OWNER_EDIT_ERRORS.invalidUrl } };
}

function needsManual(reason: ManualReason, link: string | null): GenerateDraftResult {
    return { status: 'needsManual', reason, prefill: { link } };
}

function limited(result: Extract<RateLimitResult, { allowed: false }>): GenerateDraftResult {
    return { status: 'limited', retryAfter: result.retryAfter };
}

/** Sciezka wpisu w locale uzytkownika — prefiks z helpera, nigdy `/en` na sztywno. */
export function duplicateUrl(slug: string, locale: Locale): string {
    const { pathname, query } = buildServiceUrl(slug, locale);
    // Lokalizujemy sama sciezke: `localizeMapPath` nie rozpozna `/map?place=…` jako `/map`.
    const localized = stringifyMapUrl({ pathname: localizeMapPath(pathname, locale), query });
    return `${localePathPrefix(locale)}${localized}`;
}

async function geoForDraft(
    draft: BusinessDraft,
    geocode: Geocode,
    knownGeo: GeoPoint | null,
): Promise<DraftGeo | null> {
    const { coverage, facts } = draft;
    if (coverage === 'online' || facts.city === null) return null;
    return geocodeToDraftGeo(geocode, { street: facts.street, city: facts.city }, knownGeo);
}

async function saveAndPreview(stored: StoredDraft): Outcome {
    const draftId = await saveDraft(stored);
    return {
        status: 'ready',
        draftId,
        preview: buildPreview({
            draft: stored.draft,
            facts: stored.draft.facts,
            webpage: stored.sourceUrl,
            languages: stored.draft.languages,
        }),
        unconfirmed: stored.draft.unconfirmed,
        logoCandidate: stored.logoCandidate,
        pin: toPin(stored.geo),
    };
}

/** LLM → weryfikacja faktow → geokodowanie → zapis. Limit generowania juz zuzyty. */
async function draftFromPage(
    source: PageSource,
    target: { sourceUrl: string; locale: Locale },
    deps: GenerateDraftDeps,
): Outcome {
    const draft = await fromPage(deps.llm, {
        text: source.text,
        structured: source.structured,
        url: source.url,
    });
    const geo = source.structured.geo;
    const knownGeo = geo ? { lat: geo.latitude, lng: geo.longitude } : null;

    return saveAndPreview({
        draft,
        locale: target.locale,
        source: 'page',
        sourceUrl: target.sourceUrl,
        logoCandidate: source.logoCandidate,
        geo: await geoForDraft(draft, deps.geocode, knownGeo),
    });
}

async function generateFromLink(request: ActionRequest, deps: GenerateDraftDeps): Outcome {
    const fetchDeadline = deps.now() + FETCH_BUDGET_MS;
    const { ip, locale } = request;

    const parsedUrl = urlSchema.safeParse(request.formData.get('url'));
    if (!parsedUrl.success) return invalidUrl();
    const url = parsedUrl.data;
    const link = classifyLink(url);
    if (link.kind === 'invalid') return invalidUrl();
    if (link.kind === 'social') return needsManual('SOCIAL_LINK', url);

    const generation = await peekGenerationLimit(ip);
    if (!generation.allowed) return limited(generation);
    // Przed zapytaniem o duplikat: limit chroni tez baze (review A, P2 #11).
    const fetchLimit = await consumeFetchLimit(ip);
    if (!fetchLimit.allowed) return limited(fetchLimit);

    const duplicate = await deps.findDuplicate(link.host, locale);
    if (duplicate !== null) {
        const { name, slug } = duplicate;
        return { status: 'duplicate', name, slug, url: duplicateUrl(slug, locale) };
    }

    const page = await readPageSource(url, {
        fetchHtml: deps.fetchHtml,
        now: deps.now,
        fetchDeadline,
    });
    if (!page.ok) {
        console.warn('add-business page unreadable', { code: page.code });
        return needsManual(SAFE_FETCH_ERROR_TO_MANUAL[page.code], url);
    }

    const consumed = await consumeGenerationLimit(ip);
    if (!consumed.allowed) return limited(consumed);

    return draftFromPage(page.source, { sourceUrl: url, locale }, deps);
}

async function generateFromOwner(request: ActionRequest, deps: GenerateDraftDeps): Outcome {
    const manual = parseManualInput(request.formData);
    if (!manual.ok) return { status: 'invalid', fieldErrors: manual.fieldErrors };

    const consumed = await consumeGenerationLimit(request.ip);
    if (!consumed.allowed) return limited(consumed);

    const draft = await fromOwner(deps.llm, manual.data);

    return saveAndPreview({
        draft,
        locale: request.locale,
        source: 'owner',
        sourceUrl: manual.data.link,
        logoCandidate: null,
        geo: await geoForDraft(draft, deps.geocode, null),
    });
}

/** Pole `mode`: `link` (domyslny krok 1) albo `manual` (formularz reczny, R6). */
export async function generateDraft(
    request: ActionRequest,
    deps: GenerateDraftDeps,
): Promise<GenerateDraftResult> {
    return withActionBoundary('generateDraft', async () => {
        const mode = modeSchema.safeParse(request.formData.get('mode'));
        if (!mode.success) {
            return { status: 'invalid', fieldErrors: { mode: OWNER_EDIT_ERRORS.invalidValue } };
        }
        return mode.data === 'manual'
            ? generateFromOwner(request, deps)
            : generateFromLink(request, deps);
    });
}
