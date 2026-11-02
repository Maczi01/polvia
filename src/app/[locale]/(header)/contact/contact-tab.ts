import { readContactPrefill } from '@/lib/premium-contact';

/**
 * Zakladki strony `/kontakt`: „Mam firme” (domyslna — dodanie wpisu z AI i Premium) oraz
 * „Mam pytanie” (formularz). Modul bez zaleznosci serwerowych — czyta go komponent kliencki.
 */

export type ContactTab = 'business' | 'question';

export const DEFAULT_CONTACT_TAB: ContactTab = 'business';

/** Ta sama nazwa i wartosc we wszystkich locale, jak `?lang=`. */
export const CONTACT_TAB_PARAM = 'tab';
export const QUESTION_TAB_VALUE = 'pytanie';

type SearchParamsReader = { get(name: string): string | null };

/** Zapytanie o premium niesie wypelniona wiadomosc, wiec zawsze otwiera formularz. */
export function readContactTab(params: SearchParamsReader): ContactTab {
    if (readContactPrefill(params) !== null) return 'question';
    if (params.get(CONTACT_TAB_PARAM) === QUESTION_TAB_VALUE) return 'question';
    return DEFAULT_CONTACT_TAB;
}
