/**
 * Premium reczne (oplacone przelewem): data `activeUntil` z bloku `premium` w
 * `data/services/<plik>.json`, zapisana jako `service_profiles.manual_premium_until`.
 *
 * Granica: premium jest aktywne do KONCA dnia `activeUntil` w strefie `Europe/Warsaw`
 * (wlacznie), czyli do polnocy rozpoczynajacej dzien nastepny. Zapisujemy te polnoc
 * (wylaczna granica, jak `expires_at` w `promoted_services` porownywane `> NOW()`), wiec
 * aktywne = `now < manualPremiumUntil`. Strefa polska, bo date ustala operator z klientem
 * w Polsce — „do 30 listopada” ma trwac caly 30 listopada czasu polskiego, takze zima (+1)
 * i latem (+2). Czas liczony na odczycie, bez crona.
 *
 * Modul czysty (bez zoda, `src/db` i `server-only`): czytaja go schemat tresci, zapytania
 * i widok profilu.
 */

export const MANUAL_PREMIUM_TIME_ZONE = 'Europe/Warsaw';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const warsawParts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANUAL_PREMIUM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

type CalendarDate = { year: number; month: number; day: number };

function parseDate(value: string): CalendarDate | null {
    const match = DATE_PATTERN.exec(value);
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    if (year === undefined || month === undefined || day === undefined) return null;
    return { year, month, day };
}

/** `RRRR-MM-DD` istniejacego dnia kalendarza (bez 2026-02-30). */
export function isCalendarDate(value: string): boolean {
    const date = parseDate(value);
    if (!date) return false;
    const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
    return (
        utc.getUTCFullYear() === date.year &&
        utc.getUTCMonth() === date.month - 1 &&
        utc.getUTCDate() === date.day
    );
}

function partOf(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
    return Number(parts.find(part => part.type === type)?.value ?? Number.NaN);
}

/** Przesuniecie czasu warszawskiego wzgledem UTC w danej chwili, w milisekundach. */
function warsawOffsetMs(instant: Date): number {
    const parts = warsawParts.formatToParts(instant);
    const asUtc = Date.UTC(
        partOf(parts, 'year'),
        partOf(parts, 'month') - 1,
        partOf(parts, 'day'),
        partOf(parts, 'hour'),
        partOf(parts, 'minute'),
        partOf(parts, 'second'),
    );
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export class InvalidManualPremiumDateError extends Error {
    readonly code = 'INVALID_MANUAL_PREMIUM_DATE';

    constructor(value: string) {
        super(`Niepoprawna data premium recznego: ${value} (oczekiwano RRRR-MM-DD)`);
        this.name = 'InvalidManualPremiumDateError';
    }
}

/**
 * Wylaczny koniec premium recznego: polnoc czasu warszawskiego rozpoczynajaca dzien po
 * `activeUntil`. Zmiana czasu w Polsce wypada o 2:00/3:00, nigdy o polnocy, wiec polnoc
 * jest jednoznaczna, a przesuniecie liczone w przyblizeniu (polnoc UTC) jest to samo.
 */
export function manualPremiumEnd(activeUntil: string): Date {
    const date = parseDate(activeUntil);
    if (!date || !isCalendarDate(activeUntil)) throw new InvalidManualPremiumDateError(activeUntil);

    const nextMidnightAsUtc = Date.UTC(date.year, date.month - 1, date.day + 1);
    return new Date(nextMidnightAsUtc - warsawOffsetMs(new Date(nextMidnightAsUtc)));
}

/** Odwrotnosc `manualPremiumEnd`: ostatni dzien premium (`RRRR-MM-DD`, czas warszawski). */
export function manualPremiumLastDay(end: Date): string {
    const parts = warsawParts.formatToParts(new Date(end.getTime() - 1));
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${partOf(parts, 'year')}-${pad(partOf(parts, 'month'))}-${pad(partOf(parts, 'day'))}`;
}

/** Czy premium reczne trwa w chwili `now`. `null` = wpis bez premium recznego. */
export function isManualPremiumActive(manualPremiumUntil: Date | null, now: Date): boolean {
    if (!manualPremiumUntil) return false;
    return now.getTime() < manualPremiumUntil.getTime();
}

/** Data dalej niz tyle lat naprzod to prawie na pewno literowka w roku (2062 zamiast 2026). */
export const MANUAL_PREMIUM_MAX_YEARS_AHEAD = 2;

export type ActiveUntilProblem = 'past' | 'too_far';

/**
 * Podejrzana data `activeUntil` w chwili `now`: `past` = premium reczne juz wygaslo
 * (dzisiejsza data jeszcze nie — trwa do polnocy), `too_far` = koniec dalej niz
 * `MANUAL_PREMIUM_MAX_YEARS_AHEAD` lat. `null` = data wiarygodna.
 */
export function describeActiveUntilProblem(
    activeUntil: string,
    now: Date,
): ActiveUntilProblem | null {
    const end = manualPremiumEnd(activeUntil);
    if (!isManualPremiumActive(end, now)) return 'past';

    const limit = new Date(now);
    limit.setUTCFullYear(limit.getUTCFullYear() + MANUAL_PREMIUM_MAX_YEARS_AHEAD);
    return end.getTime() > limit.getTime() ? 'too_far' : null;
}
