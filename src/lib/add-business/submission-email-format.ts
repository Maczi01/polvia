import { WEEKDAY_KEYS, type Weekday } from '@/db/service-input-schema';
import type { BuildServiceJsonResult, ServiceJson } from '@/lib/add-business/build-service-json';
import type { StoredDraft } from '@/lib/add-business/draft-store';

/**
 * Wejscie i klocki tekstu maili po wysylce zgloszenia — wspolne dla maila operatora
 * (`operator-email-text.ts`) i potwierdzenia dla wlasciciela (`submission-emails.ts`).
 */

export type BuiltServiceEntry = Extract<BuildServiceJsonResult, { ok: true }>;

export interface SubmissionEmailInput {
    entry: BuiltServiceEntry;
    stored: Pick<StoredDraft, 'locale' | 'source' | 'sourceUrl'>;
    submitterEmail: string;
    notes: string | null;
    /** PNG po `processLogoUpload` / `processLogoCandidate`; `null` = brak logo. */
    logo: Buffer | null;
    /** Wspolrzedne z pinezki ustawionej recznie przez wlasciciela, bez geokodowania. */
    manualPin: boolean;
}

export type Location = ServiceJson['locations'][number];
type Hours = NonNullable<Location['openingHours']>;

export const NONE = '(brak)';

export function formatAddress(location: Location | undefined): string | null {
    if (location === undefined) return null;
    const cityLine = [location.postcode, location.city].filter(Boolean).join(' ');
    return [location.street, cityLine].filter(Boolean).join(', ');
}

export function formatHours(
    hours: Hours | undefined,
    dayLabel: (day: Weekday) => string,
): string[] {
    if (hours === undefined) return [];
    return WEEKDAY_KEYS.flatMap(day => {
        const entry = hours[day];
        return entry === undefined ? [] : [`${dayLabel(day)}: ${entry.open}-${entry.close}`];
    });
}

export function section(title: string, lines: string[]): string {
    return [`== ${title} ==`, ...(lines.length > 0 ? lines : [NONE])].join('\n');
}

export function line(label: string, value: string | null | undefined): string {
    return `${label}: ${value || NONE}`;
}

export function bulletList(items: string[]): string[] {
    return items.map(item => `- ${item}`);
}
