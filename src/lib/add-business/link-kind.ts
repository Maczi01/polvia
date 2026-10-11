/**
 * Klasyfikacja linku podanego przez wlasciciela firmy (D8).
 *
 * Link do serwisu spolecznosciowego / katalogu / mapy nie jest strona firmy:
 * nie pobieramy go (tryb reczny, R6) i nie bierzemy jego hosta do detekcji
 * duplikatow po domenie (R7) — inaczej kazda firma z Instagramem bylaby
 * "duplikatem" kazdej innej.
 *
 * Czysta funkcja bez zaleznosci serwerowych — uzywa jej tez tryb reczny (U8).
 */

/**
 * Hosty po normalizacji (lowercase, bez `www.`). Dopasowanie obejmuje tez
 * subdomeny (`m.facebook.com`, `pl.linkedin.com`, `business.site`).
 *
 * Booksy i ZnanyLekarz sa tu celowo: to profile w katalogach, nie strony
 * wlasne — host jest wspolny dla tysiecy firm, wiec jako "domena wlasna"
 * psulby detekcje duplikatow.
 */
const SOCIAL_HOSTS: readonly string[] = [
    'instagram.com',
    'facebook.com',
    'fb.com',
    'fb.me',
    'messenger.com',
    'm.me',
    'tiktok.com',
    'youtube.com',
    'youtu.be',
    'linkedin.com',
    'x.com',
    'twitter.com',
    't.me',
    'telegram.me',
    'wa.me',
    'whatsapp.com',
    'viber.com',
    'threads.net',
    'pinterest.com',
    'maps.app.goo.gl',
    'g.page',
    'business.site',
    'tripadvisor.com',
    'booksy.com',
    'znanylekarz.pl',
    'olx.pl',
    'linktr.ee',
];

/** Google Maps to sciezka, nie host: `google.com/maps`, `google.pl/maps`, `goo.gl/maps`. */
const GOOGLE_MAPS_HOST = /^(maps\.)?google\.[a-z.]+$/;
const GOOGLE_MAPS_PATH = /^\/maps(\/|$)/;

export type LinkKind =
    | { kind: 'social'; host: string }
    | { kind: 'own-domain'; host: string }
    | { kind: 'invalid' };

/** Lowercase i bez wiodacego `www.`. `URL` juz zamienia host na lowercase i punycode. */
export function normalizeHost(host: string): string {
    return host.toLowerCase().replace(/^www\./, '');
}

function matchesHost(host: string, candidate: string): boolean {
    return host === candidate || host.endsWith(`.${candidate}`);
}

function isGoogleMaps(host: string, pathname: string): boolean {
    if (host.startsWith('maps.google.')) return GOOGLE_MAPS_HOST.test(host);
    if (host === 'goo.gl') return GOOGLE_MAPS_PATH.test(pathname);
    return GOOGLE_MAPS_HOST.test(host) && GOOGLE_MAPS_PATH.test(pathname);
}

export function isSocialHost(host: string, pathname = '/'): boolean {
    const normalized = normalizeHost(host);
    if (isGoogleMaps(normalized, pathname)) return true;
    return SOCIAL_HOSTS.some(candidate => matchesHost(normalized, candidate));
}

/**
 * Klasyfikuje link. Tylko `http:`/`https:` — `javascript:`, `mailto:` itd.
 * to `invalid`, tak samo jak tekst, ktory nie jest URL-em.
 */
export function classifyLink(rawUrl: string): LinkKind {
    if (!URL.canParse(rawUrl)) return { kind: 'invalid' };

    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { kind: 'invalid' };

    const host = normalizeHost(url.hostname);
    if (host === '') return { kind: 'invalid' };
    if (isSocialHost(host, url.pathname)) return { kind: 'social', host };

    return { kind: 'own-domain', host };
}
