import type { FactField, LanguageCode, LocalizedText } from '@/lib/add-business/draft-schema';
import type { GeocodeErrorCode } from '@/lib/add-business/geocode';
import type { OpeningHours } from '@/lib/add-business/jsonld-facts';
import type { DraftGenerationErrorCode } from '@/lib/add-business/llm-draft';
import type { Socials } from '@/lib/add-business/social-links';
import type { OwnerEditErrorKey } from '@/lib/add-business/owner-edits-schema';
import type { PageSourceErrorCode } from '@/lib/add-business/page-sources';
import type { SafeFetchErrorCode } from '@/lib/add-business/safe-fetch';
import type { Category } from '@/lib/categories';
import type { Coverage } from '@/lib/coverage';

/**
 * Kontrakt wynikow akcji „Dodaj firme" dla UI (U9). Modul bez zaleznosci serwerowych —
 * importy z modulow `server-only` sa wylacznie typami, wiec plik nadaje sie do komponentu
 * klienckiego.
 *
 * Kazdy wynik to unia po `status`. Blad niesie tylko stabilny kod z zamknietego zbioru
 * (`ACTION_ERROR_CODES`) — UI tlumaczy kod, `message` jest techniczny i nie trafia na ekran.
 * Surowy blad modulu nigdy nie wychodzi poza serwer.
 */

// --- Kody bledow -----------------------------------------------------------------

/** Zamkniety zbior kodow dla UI. Kody sa stabilne: UI ma dla kazdego klucz tlumaczenia. */
export const ACTION_ERROR_CODES = [
    'GENERATION_FAILED',
    'DRAFT_EXPIRED',
    'RELOCATION_LIMIT',
    'ADDRESS_NOT_FOUND',
    'GEOCODE_UNAVAILABLE',
    'INVALID_ENTRY',
    'SEND_FAILED',
    'INTERNAL',
] as const;

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number];

export interface ActionError {
    code: ActionErrorCode;
    message: string;
}

const ACTION_ERROR_MESSAGES: Record<ActionErrorCode, string> = {
    GENERATION_FAILED: 'Nie udalo sie wygenerowac szkicu wpisu',
    DRAFT_EXPIRED: 'Szkic wygasl albo zostal juz wyslany',
    RELOCATION_LIMIT: 'Wyczerpany limit sprawdzen adresu dla tego szkicu',
    ADDRESS_NOT_FOUND: 'Nie znaleziono adresu na mapie',
    GEOCODE_UNAVAILABLE: 'Wyszukiwanie adresu jest chwilowo niedostepne',
    INVALID_ENTRY: 'Wpis nie przeszedl walidacji',
    SEND_FAILED: 'Nie udalo sie wyslac zgloszenia',
    INTERNAL: 'Wewnetrzny blad serwera',
};

/**
 * Tabele mapowania kodow modulow na kody UI. Moduly maja rozne modele bledow (unie z kodami,
 * wyjatki); te same nazwy znacza w nich co innego (`UPSTREAM_FAILED` w geokoderze i w LLM),
 * wiec tlumaczymy je jawnie i wyczerpujaco — nowy kod w module bez wpisu tutaj nie skompiluje
 * sie. Kody, ktore nazywaja sie tak samo jak kod UI (`DRAFT_EXPIRED`, `RELOCATION_LIMIT`,
 * `INVALID_ENTRY`, `SEND_FAILED`), przechodza bez tabeli.
 */
export const GEOCODE_ERROR_TO_ACTION: Record<GeocodeErrorCode, ActionErrorCode> = {
    NOT_FOUND: 'ADDRESS_NOT_FOUND',
    MISMATCH: 'ADDRESS_NOT_FOUND',
    RATE_LIMITED: 'GEOCODE_UNAVAILABLE',
    UPSTREAM_FAILED: 'GEOCODE_UNAVAILABLE',
};

export const DRAFT_GENERATION_ERROR_TO_ACTION: Record<DraftGenerationErrorCode, ActionErrorCode> = {
    UPSTREAM_FAILED: 'GENERATION_FAILED',
    INVALID_RESPONSE: 'GENERATION_FAILED',
};

/**
 * Powod przejscia do trybu recznego (R6). Kazda porazka pobrania strony to dla wlasciciela
 * to samo: „nie umiemy przeczytac strony, wpisz dane sam" — szczegol trafia tylko do logu.
 */
export type ManualReason = 'SOCIAL_LINK' | 'UNREADABLE';

export const SAFE_FETCH_ERROR_TO_MANUAL: Record<SafeFetchErrorCode, ManualReason> = {
    INVALID_URL: 'UNREADABLE',
    BLOCKED_ADDRESS: 'UNREADABLE',
    TIMEOUT: 'UNREADABLE',
    TOO_LARGE: 'UNREADABLE',
    BAD_CONTENT_TYPE: 'UNREADABLE',
    HTTP_ERROR: 'UNREADABLE',
    TOO_MANY_REDIRECTS: 'UNREADABLE',
    NETWORK_ERROR: 'UNREADABLE',
};

export const PAGE_SOURCE_ERROR_TO_MANUAL: Record<PageSourceErrorCode, ManualReason> = {
    ...SAFE_FETCH_ERROR_TO_MANUAL,
    INVALID_FINAL_URL: 'UNREADABLE',
};

export function toActionError(code: ActionErrorCode): ActionError {
    return { code, message: ACTION_ERROR_MESSAGES[code] };
}

// --- Bledy pol formularza ----------------------------------------------------------

/** Klucze tlumaczen bledow pol spoza `OWNER_EDIT_ERRORS` (U9 dodaje je do 4 locale). */
export const EXTRA_FIELD_ERRORS = {
    invalidLogo: 'addBusiness.errors.invalidLogo',
    logoTooLarge: 'addBusiness.errors.logoTooLarge',
    tooShort: 'addBusiness.errors.tooShort',
} as const;

export type FieldErrorKey =
    | OwnerEditErrorKey
    | (typeof EXTRA_FIELD_ERRORS)[keyof typeof EXTRA_FIELD_ERRORS];

/** Klucz = nazwa pola formularza (`hours.monday.open`, `logo`), wartosc = klucz tlumaczenia. */
export type FieldErrors = Record<string, FieldErrorKey>;

// --- Dane dla podgladu -----------------------------------------------------------

/** Pin na statycznej mapie podgladu (D10). `approximate`: geokoder trafil ulice/miasto. */
export interface DraftPin {
    lat: number;
    lng: number;
    approximate: boolean;
}

/** Wszystko, co pokazuje karta podgladu (R5). Pole `null` = brak danych. */
export interface BusinessPreview {
    name: string | null;
    category: Category;
    coverage: Coverage;
    languages: LanguageCode[];
    tags: LocalizedText[];
    descriptions: LocalizedText;
    street: string | null;
    postcode: string | null;
    city: string | null;
    phoneNumber: string | null;
    email: string | null;
    webpage: string | null;
    openingHours: OpeningHours | null;
    /** Tylko niepuste linki (klucze `SOCIAL_KEYS`); prefill pol `socials.<klucz>`. */
    socials: Socials;
    /** `+<cyfry>`; prefill pola `whatsappNumber`. */
    whatsappNumber: string | null;
}

/**
 * Czy szkic ma choc jeden dzien godzin — domyslny stan checkboxa `hoursEnabled` (B).
 * `{}` liczy sie jak brak godzin.
 */
export function hasOpeningHours(hours: OpeningHours | null): boolean {
    return hours !== null && Object.keys(hours).length > 0;
}

// --- Wyniki akcji ------------------------------------------------------------------

export type ActionFailure = { status: 'error'; error: ActionError };
export type InvalidInput = { status: 'invalid'; fieldErrors: FieldErrors };
export type RateLimited = { status: 'limited'; retryAfter: number };

export type GenerateDraftResult =
    | {
          status: 'ready';
          draftId: string;
          preview: BusinessPreview;
          /** Pola „do uzupelnienia" (R4). */
          unconfirmed: FactField[];
          /** Absolutny URL proponowanego logo ze strony (R11) — UI laduje go wprost w `<img>`. */
          logoCandidate: string | null;
          /** `null`: wpis `online` albo geokoder nie trafil. */
          pin: DraftPin | null;
      }
    | {
          status: 'duplicate';
          name: string;
          /** Slug lokalizacji: `Link` z `@/i18n/navigation` → `{ pathname: '/map', query: { place } }`. */
          slug: string;
      }
    | {
          status: 'needsManual';
          reason: ManualReason;
          /** Link do wstawienia w formularzu recznym. */
          prefill: { link: string | null };
      }
    | RateLimited
    | InvalidInput
    | ActionFailure;

export type RelocateResult =
    | { status: 'relocated'; pin: DraftPin; remainingRelocations: number }
    | InvalidInput
    | ActionFailure;

export type SubmitDraftResult =
    | {
          status: 'sent';
          /** Karta po edycji — do ekranu podziekowania (R15). */
          card: BusinessPreview;
          unconfirmed: FactField[];
          pin: DraftPin | null;
          /** Czy do zgloszenia trafilo logo (upload albo kandydat ze strony). */
          hasLogo: boolean;
      }
    | RateLimited
    | InvalidInput
    | ActionFailure;

export function actionFailure(code: ActionErrorCode): ActionFailure {
    return { status: 'error', error: toActionError(code) };
}
