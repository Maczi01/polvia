import {
    SOCIAL_KEYS,
    SOCIAL_URL_MAX_LENGTH,
    type SocialKey,
} from '@/lib/add-business/form-limits';
import { matchesHost, normalizeHost } from '@/lib/add-business/link-kind';

/**
 * Rozpoznawanie serwisu po linku i numer WhatsApp — czyste funkcje bez zoda, wspolne dla
 * prefillu szkicu (JSON-LD `sameAs`, link z kroku 1) i walidacji pol `socials.*`.
 *
 * Karta katalogu (`service-card.tsx`) buduje przycisk WhatsApp z `whatsappNumber`
 * (`wa.me/<cyfry>`), a `socials.whatsapp` jest tylko fallbackiem; wszystkie wpisy w
 * `data/services/` trzymaja numer w `whatsappNumber`. Dlatego link `wa.me/<cyfry>`
 * zamieniamy na numer, a w `socials.whatsapp` zostaje tylko link bez numeru
 * (np. `wa.me/message/…`).
 */

export type Socials = Partial<Record<SocialKey, string>>;

/** Hosty po `normalizeHost`; subdomeny pasuja (`m.facebook.com`, `pl.linkedin.com`). */
const SOCIAL_HOSTS: Record<SocialKey, readonly string[]> = {
    whatsapp: ['wa.me', 'whatsapp.com'],
    telegram: ['t.me', 'telegram.me'],
    facebook: ['facebook.com', 'fb.com', 'fb.me'],
    instagram: ['instagram.com'],
    tiktok: ['tiktok.com'],
    youtube: ['youtube.com', 'youtu.be'],
    linkedin: ['linkedin.com'],
    viber: ['viber.com', 'vb.me'],
    tripadvisor: [],
    x: ['x.com', 'twitter.com'],
};

/** Tripadvisor ma domene krajowa w wielu wariantach: `.com`, `.pl`, `.co.uk`, `.com.ua`. */
const TRIPADVISOR_HOST = /^([a-z0-9-]+\.)*tripadvisor\.[a-z]{2,3}(\.[a-z]{2})?$/;

/** Domyslny kierunkowy: formularz jest dla firm w Polsce. */
const DEFAULT_COUNTRY_CODE = '48';
const NATIONAL_NUMBER_DIGITS = 9;
/** E.164: najwyzej 15 cyfr z kierunkowym. */
const MIN_INTERNATIONAL_DIGITS = 8;
const MAX_INTERNATIONAL_DIGITS = 15;
const PHONE_CHARACTERS = /^\+?[\d\s-]+$/;

function parseHttpUrl(value: string): URL | null {
    if (!URL.canParse(value)) return null;
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
}

function hostMatchesKey(host: string, key: SocialKey): boolean {
    if (key === 'tripadvisor') return TRIPADVISOR_HOST.test(host);
    return SOCIAL_HOSTS[key].some(candidate => matchesHost(host, candidate));
}

/** Serwis, do ktorego prowadzi link http(s), albo `null` (strona wlasna, zly URL). */
export function socialKeyForUrl(value: string): SocialKey | null {
    const url = parseHttpUrl(value);
    if (url === null) return null;
    const host = normalizeHost(url.hostname);
    return SOCIAL_KEYS.find(key => hostMatchesKey(host, key)) ?? null;
}

/**
 * Numer w formacie `+<cyfry>` albo `null`, gdy wejscie nie jest numerem telefonu.
 * 9 cyfr bez kierunkowego = numer polski; `00` na poczatku = `+`.
 */
export function normalizeWhatsappNumber(raw: string): string | null {
    const trimmed = raw.trim();
    if (!PHONE_CHARACTERS.test(trimmed)) return null;

    const compact = trimmed.replace(/[\s-]/g, '');
    const hasPlus = compact.startsWith('+');
    let digits = hasPlus ? compact.slice(1) : compact;
    if (!hasPlus && digits.startsWith('00')) digits = digits.slice(2);
    else if (!hasPlus && digits.length === NATIONAL_NUMBER_DIGITS) {
        digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
    }

    const isValidLength =
        digits.length >= MIN_INTERNATIONAL_DIGITS && digits.length <= MAX_INTERNATIONAL_DIGITS;
    return /^\d+$/.test(digits) && isValidLength ? `+${digits}` : null;
}

/** `wa.me/48500600700` i `api.whatsapp.com/send?phone=48500600700` → `+48500600700`. */
export function whatsappNumberFromUrl(value: string): string | null {
    const url = parseHttpUrl(value);
    if (url === null) return null;
    const host = normalizeHost(url.hostname);

    if (host === 'wa.me') {
        const path = url.pathname.replace(/^\/|\/$/g, '');
        return /^\d+$/.test(path) ? normalizeWhatsappNumber(`+${path}`) : null;
    }
    if (matchesHost(host, 'whatsapp.com')) {
        const phone = url.searchParams.get('phone');
        return phone !== null && /^\d+$/.test(phone) ? normalizeWhatsappNumber(`+${phone}`) : null;
    }
    return null;
}

export interface SocialLinks {
    socials: Socials;
    whatsappNumber: string | null;
}

/**
 * Prefill szkicu z linkow zrodla (JSON-LD `sameAs`, link z kroku 1). Pierwszy link danego
 * serwisu wygrywa; link spoza znanych serwisow i za dlugi na kolumne jest pomijany.
 */
export function socialLinksFromUrls(urls: readonly string[]): SocialLinks {
    const result: SocialLinks = { socials: {}, whatsappNumber: null };

    for (const url of urls) {
        if (url.length > SOCIAL_URL_MAX_LENGTH) continue;
        const key = socialKeyForUrl(url);
        if (key === null || result.socials[key] !== undefined) continue;

        const number = key === 'whatsapp' ? whatsappNumberFromUrl(url) : null;
        if (number === null) result.socials[key] = url;
        else result.whatsappNumber ??= number;
    }
    return result;
}
