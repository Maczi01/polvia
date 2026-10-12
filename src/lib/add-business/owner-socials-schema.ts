import { z } from 'zod';

import {
    SOCIAL_KEYS,
    SOCIAL_URL_MAX_LENGTH,
    type SocialKey,
    WHATSAPP_NUMBER_MAX_LENGTH,
} from '@/lib/add-business/form-limits';
import {
    emptyToNull,
    isHttpUrl,
    OWNER_EDIT_ERRORS,
    text,
} from '@/lib/add-business/owner-edit-fields';
import {
    normalizeWhatsappNumber,
    type SocialLinks,
    type Socials,
    socialKeyForUrl,
    whatsappNumberFromUrl,
} from '@/lib/add-business/social-links';

/**
 * Pola `socials.<klucz>` i `whatsappNumber` formularza edycji (A). Wynik ma ksztalt kolumn
 * `service_locations.socials` / `whatsapp_number`: tylko niepuste linki, numer `+<cyfry>`.
 */

/** Uchwyt `@nazwa` / `nazwa` → pelny URL; reguly nazw wg serwisow. */
const HANDLE_URLS: Partial<Record<SocialKey, { pattern: RegExp; url: (name: string) => string }>> =
    {
        telegram: { pattern: /^@?([A-Za-z0-9_]{5,32})$/, url: name => `https://t.me/${name}` },
        instagram: {
            pattern: /^@?([A-Za-z0-9._]{1,30})$/,
            url: name => `https://www.instagram.com/${name}/`,
        },
        tiktok: {
            pattern: /^@?([A-Za-z0-9._]{2,24})$/,
            url: name => `https://www.tiktok.com/@${name}`,
        },
        x: { pattern: /^@?([A-Za-z0-9_]{1,15})$/, url: name => `https://x.com/${name}` },
    };

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Uchwyt → URL serwisu; `facebook.com/nowak` bez schematu → `https://facebook.com/nowak`. */
function toSocialUrl(key: SocialKey, value: string): string {
    const handle = HANDLE_URLS[key];
    const name = handle?.pattern.exec(value)?.[1];
    if (handle !== undefined && name !== undefined) return handle.url(name);
    return HAS_SCHEME.test(value) ? value : `https://${value}`;
}

function socialField(key: SocialKey) {
    return z
        .preprocess(
            emptyToNull,
            text().max(SOCIAL_URL_MAX_LENGTH, OWNER_EDIT_ERRORS.tooLong).nullable(),
        )
        .transform((value, ctx): string | null => {
            if (value === null) return null;
            const url = toSocialUrl(key, value);
            const issue = socialUrlIssue(key, url);
            if (issue === null) return url;
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
            return z.NEVER;
        });
}

function socialUrlIssue(key: SocialKey, url: string): string | null {
    if (!isHttpUrl(url)) return OWNER_EDIT_ERRORS.invalidUrl;
    if (url.length > SOCIAL_URL_MAX_LENGTH) return OWNER_EDIT_ERRORS.tooLong;
    return socialKeyForUrl(url) === key ? null : OWNER_EDIT_ERRORS.wrongSocialService;
}

/** Literal zamiast `Object.fromEntries`, zeby typ pol nie wymagal `as`; `satisfies` pilnuje kompletu. */
const socialFields = {
    whatsapp: socialField('whatsapp'),
    telegram: socialField('telegram'),
    facebook: socialField('facebook'),
    instagram: socialField('instagram'),
    tiktok: socialField('tiktok'),
    youtube: socialField('youtube'),
    linkedin: socialField('linkedin'),
    viber: socialField('viber'),
    tripadvisor: socialField('tripadvisor'),
    x: socialField('x'),
} satisfies Record<SocialKey, ReturnType<typeof socialField>>;

/** Bledy maja sciezke `socials.<klucz>` — dokladnie nazwe pola formularza. */
export const socialsSchema = z.object(socialFields).transform((fields): Socials => {
    const socials: Socials = {};
    for (const key of SOCIAL_KEYS) {
        const value = fields[key];
        if (value !== null) socials[key] = value;
    }
    return socials;
});

export const whatsappNumberSchema = z
    .preprocess(
        emptyToNull,
        text().max(WHATSAPP_NUMBER_MAX_LENGTH, OWNER_EDIT_ERRORS.tooLong).nullable(),
    )
    .transform((value, ctx): string | null => {
        if (value === null) return null;
        const number = normalizeWhatsappNumber(value);
        if (number !== null) return number;
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: OWNER_EDIT_ERRORS.invalidPhone });
        return z.NEVER;
    });

/**
 * Karta buduje przycisk WhatsApp z `whatsappNumber`, wiec link `wa.me/<cyfry>` z pola
 * `socials.whatsapp` zamieniamy na numer (gdy numeru nie podano) i usuwamy z `socials`.
 */
export function resolveWhatsapp(socials: Socials, whatsappNumber: string | null): SocialLinks {
    const { whatsapp, ...rest } = socials;
    const fromLink = whatsapp === undefined ? null : whatsappNumberFromUrl(whatsapp);
    if (fromLink === null) return { socials, whatsappNumber };
    return { socials: rest, whatsappNumber: whatsappNumber ?? fromLink };
}

export function readSocialFields(formData: FormData): Record<string, unknown> {
    return Object.fromEntries(SOCIAL_KEYS.map(key => [key, formData.get(`socials.${key}`)]));
}
