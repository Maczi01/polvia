import { parseAsStringLiteral, useQueryState, type UseQueryStateReturn } from 'nuqs';

import { SERVICE_LANGUAGES, type ServiceLanguage } from '@/lib/languages';

/**
 * Parser `?lang` — jedyne miejsce, ktore zna nazwe parametru i liste kodow. Nieznany kod
 * daje `null`, czyli brak filtra (R10), nie pusta liste. `push`, zeby Wstecz cofalo zmiane
 * jezyka (R7).
 */
const languageParser = parseAsStringLiteral(SERVICE_LANGUAGES).withOptions({ history: 'push' });

/** Krotka `[jezyk | null, setter]` — konsumenci nie importuja typow nuqs. */
export type LanguageFilterState = UseQueryStateReturn<ServiceLanguage, undefined>;

/**
 * Wybrany jezyk obslugi z adresu. Celowo bez wartosci domyslnej i bez odczytu locale
 * strony — filtr nigdy nie wlacza sie sam (R11).
 */
export function useLanguageFilter(): LanguageFilterState {
    return useQueryState('lang', languageParser);
}
