import 'server-only';

import {
    checkRateLimit,
    peekRateLimit,
    type RateLimitOptions,
    type RateLimitResult,
} from '@/lib/rate-limit';

/**
 * Limity formularza „Dodaj firme" (D7). Wszystkie w oknie 24 h, na liczniku
 * `checkRateLimit` — `peek` czyta ten sam klucz bez inkrementacji.
 *
 * Kolejnosc uzycia w orkiestratorze (U8):
 * 1. `peekGenerationLimit` przed fetchem — zeby nie pobierac stron na darmo;
 * 2. `consumeFetchLimit` tuz przed fetchem;
 * 3. `consumeGenerationLimit` tuz przed LLM — nieudany fetch i wykryty duplikat
 *    nie zuzywaja limitu generowania (R16).
 */

export const ADD_BUSINESS_WINDOW_SECONDS = 60 * 60 * 24;

/** R16: dwa generowania na IP na dobe. */
export const GENERATIONS_PER_IP = 2;
/** Bezpiecznik kosztu OpenAI dla calego serwisu. */
export const GENERATIONS_GLOBAL = 40;
/** Ogranicza uzycie serwera jako proxy do pobierania stron. */
export const FETCHES_PER_IP = 6;
export const SUBMISSIONS_PER_IP = 2;

const KEY_PREFIX = 'add-business';

export const GENERATION_GLOBAL_KEY = `${KEY_PREFIX}:gen:global`;

export function generationIpKey(ip: string): string {
    return `${KEY_PREFIX}:gen:${ip}`;
}

export function fetchIpKey(ip: string): string {
    return `${KEY_PREFIX}:fetch:${ip}`;
}

export function submitIpKey(ip: string): string {
    return `${KEY_PREFIX}:submit:${ip}`;
}

function ipGenerationOptions(ip: string): RateLimitOptions {
    return {
        key: generationIpKey(ip),
        max: GENERATIONS_PER_IP,
        windowSeconds: ADD_BUSINESS_WINDOW_SECONDS,
    };
}

const GLOBAL_GENERATION_OPTIONS: RateLimitOptions = {
    key: GENERATION_GLOBAL_KEY,
    max: GENERATIONS_GLOBAL,
    windowSeconds: ADD_BUSINESS_WINDOW_SECONDS,
};

/** `remaining` to mniejsza z pul — tyle generowan klient faktycznie jeszcze ma. */
function combine(ipRemaining: number, global: RateLimitResult): RateLimitResult {
    if (!global.allowed) return global;
    return { allowed: true, remaining: Math.min(ipRemaining, global.remaining) };
}

/** Czy generowanie zmiesci sie w limicie IP i globalnym. Niczego nie zuzywa. */
export async function peekGenerationLimit(ip: string): Promise<RateLimitResult> {
    const perIp = await peekRateLimit(ipGenerationOptions(ip));
    if (!perIp.allowed) return perIp;

    return combine(perIp.remaining, await peekRateLimit(GLOBAL_GENERATION_OPTIONS));
}

/**
 * Zuzywa jedno generowanie. Najpierw licznik IP: klient ponad swoim limitem nie
 * moze wtedy wypalac puli globalnej kolejnymi probami. Odwrotny przypadek (IP
 * zuzyte, globalny pelny) kosztuje klienta jedno miejsce — zdarza sie tylko przy
 * wyscigu, bo `peekGenerationLimit` odrzuca go wczesniej.
 */
export async function consumeGenerationLimit(ip: string): Promise<RateLimitResult> {
    const perIp = await checkRateLimit(ipGenerationOptions(ip));
    if (!perIp.allowed) return perIp;

    return combine(perIp.remaining, await checkRateLimit(GLOBAL_GENERATION_OPTIONS));
}

export async function consumeFetchLimit(ip: string): Promise<RateLimitResult> {
    return checkRateLimit({
        key: fetchIpKey(ip),
        max: FETCHES_PER_IP,
        windowSeconds: ADD_BUSINESS_WINDOW_SECONDS,
    });
}

export async function consumeSubmitLimit(ip: string): Promise<RateLimitResult> {
    return checkRateLimit({
        key: submitIpKey(ip),
        max: SUBMISSIONS_PER_IP,
        windowSeconds: ADD_BUSINESS_WINDOW_SECONDS,
    });
}
