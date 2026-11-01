import { isValidServiceSlug } from './service-slug-format';

/**
 * Sprzedaz premium przez kontakt (platnosci online wylaczone): link „Przejdz na Premium”
 * prowadzi do `/kontakt` z tematem i slugiem firmy w query, a formularz kontaktowy
 * wypelnia z nich temat i wiadomosc. Modul bez zaleznosci — czyta go komponent kliencki.
 */

export const CONTACT_TOPIC_PARAM = 'topic';
export const CONTACT_SERVICE_PARAM = 'firma';
export const PREMIUM_CONTACT_TOPIC = 'premium';

export type PremiumContactQuery = Record<string, string>;

/** Query linku do `/kontakt`; bez slugu (np. z `/cennik`) sam temat. */
export function premiumContactQuery(slug?: string): PremiumContactQuery {
    const query: PremiumContactQuery = { [CONTACT_TOPIC_PARAM]: PREMIUM_CONTACT_TOPIC };
    if (slug !== undefined) query[CONTACT_SERVICE_PARAM] = slug;
    return query;
}

/** Wstepne wypelnienie formularza z query: zapytanie o premium, opcjonalnie dla firmy. */
export type ContactPrefill = { kind: 'premium'; slug: string | null };

type SearchParamsReader = { get(name: string): string | null };

/**
 * `null`, gdy adres nie niesie tematu premium. Slug spoza formatu slugu jest pomijany —
 * query przychodzi z dowolnego linku, a trafia do tresci wiadomosci.
 */
export function readContactPrefill(params: SearchParamsReader): ContactPrefill | null {
    if (params.get(CONTACT_TOPIC_PARAM) !== PREMIUM_CONTACT_TOPIC) return null;

    const slug = params.get(CONTACT_SERVICE_PARAM);
    return { kind: 'premium', slug: slug !== null && isValidServiceSlug(slug) ? slug : null };
}
