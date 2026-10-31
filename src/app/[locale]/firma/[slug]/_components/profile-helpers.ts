import type { Socials } from '@/types';

import type { ProfileLocation, ServiceProfileView } from './service-profile-types';

/** Glowna lokalizacja wpisu: oznaczona `isMain`, a bez oznaczenia pierwsza. */
export function getMainLocation(locations: readonly ProfileLocation[]): ProfileLocation | null {
    return locations.find(location => location.isMain) ?? locations[0] ?? null;
}

function hasAddress(location: ProfileLocation): boolean {
    return Boolean(location.street?.trim() || location.city?.trim());
}

/**
 * Lokalizacje z adresem do pokazania. Wpis `online` nie ma punktu obslugi, wiec
 * nawet zapomniany adres w danych nie trafia na strone.
 */
export function getAddressedLocations(
    profile: Pick<ServiceProfileView, 'coverage' | 'locations'>,
): ProfileLocation[] {
    if (profile.coverage === 'online') return [];
    const main = getMainLocation(profile.locations);
    const ordered = main
        ? [main, ...profile.locations.filter(location => location !== main)]
        : [];
    return ordered.filter(hasAddress);
}

/** Miasto pod nazwa firmy w naglowku; wpis bez punktu obslugi go nie ma. */
export function getHeaderCity(profile: ServiceProfileView): string | null {
    return getAddressedLocations(profile)[0]?.city ?? null;
}

export function toWebsiteHref(webpage: string): string {
    return webpage.startsWith('http') ? webpage : `https://${webpage}`;
}

/**
 * Domena bez `www.` do wyswietlenia; niepoprawny adres zostaje jak jest.
 * Bez `instanceof TypeError`: jsdom rzuca blad z innego realmu (learned-patterns).
 */
export function toDisplayDomain(webpage: string): string {
    try {
        return new URL(toWebsiteHref(webpage)).hostname.replace(/^www\./, '');
    } catch {
        return webpage;
    }
}

/** Numer WhatsApp ma pierwszenstwo przed linkiem z `socials.whatsapp` (jak w karcie). */
export function toWhatsAppHref(location: ProfileLocation): string | null {
    if (location.whatsappNumber) {
        return `https://wa.me/${location.whatsappNumber.replace(/\D/g, '')}`;
    }
    return location.socials?.whatsapp ?? null;
}

/** Nawigacja tylko do punktu ze wspolrzednymi — bez nich link mialby `null,null`. */
export function toNavigateHref(location: ProfileLocation): string | null {
    if (location.latitude === null || location.longitude === null) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
}

export type ActionHrefs = {
    call: string | null;
    whatsapp: string | null;
    telegram: string | null;
    navigate: string | null;
};

/**
 * Linki przyciskow akcji. Telegram i WhatsApp to przyciski, nie ikony social media:
 * dla czesci wpisow to glowny kanal kontaktu (jak w karcie uslugi).
 */
export function getActionHrefs(location: ProfileLocation, showNavigate: boolean): ActionHrefs {
    return {
        call: location.phoneNumber ? `tel:${location.phoneNumber}` : null,
        whatsapp: toWhatsAppHref(location),
        telegram: location.socials?.telegram ?? null,
        navigate: showNavigate ? toNavigateHref(location) : null,
    };
}

export function hasAnyAction(hrefs: ActionHrefs): boolean {
    return Object.values(hrefs).some(Boolean);
}

/** Sieci renderowane jako ikony; WhatsApp i Telegram to przyciski akcji. */
export const SOCIAL_ICON_KEYS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x'] as const;

export type SocialIconKey = (typeof SOCIAL_ICON_KEYS)[number];

export function getSocialLinks(
    socials: Socials | null,
): { key: SocialIconKey; href: string }[] {
    if (!socials) return [];
    return SOCIAL_ICON_KEYS.flatMap(key => {
        const href = socials[key];
        return href ? [{ key, href }] : [];
    });
}
