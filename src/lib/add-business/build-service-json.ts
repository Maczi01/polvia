import type { z } from 'zod';

import { buildServiceSlug, serviceInputSchema, WEEKDAY_KEYS } from '@/db/service-input-schema';
import { type DraftFacts, FACT_FIELDS, type FactField } from '@/lib/add-business/draft-schema';
import type { DraftGeo, StoredDraft } from '@/lib/add-business/draft-store';
import type { OpeningHours } from '@/lib/add-business/jsonld-facts';
import type { OwnerEdits } from '@/lib/add-business/owner-edits-schema';

/**
 * Sklada plik `data/services/<slug>.json` ze szkicu (Redis) i edycji wlasciciela (D3).
 *
 * - Kategoria, zasieg, tagi i opisy pochodza wylacznie ze szkicu (R9).
 * - Fakty, strona i jezyki pochodza z formularza — jest wstepnie wypelniony szkicem, wiec
 *   to kompletny stan po edycji: edycja wygrywa, wyczyszczone pole znika z JSON-a.
 * - Wspolrzedne i wojewodztwo pochodza z `geo` (szkicu albo po relokacji pinu); kod
 *   pocztowy z geo tylko uzupelnia pole, ktorego wlasciciel nie podal.
 *
 * Wynik waliduje `serviceInputSchema` — tym samym schematem, ktory czyta `db:add`.
 * Jedyny tolerowany blad to brak wspolrzednych przy `local`/`hybrid` (geokoder nie trafil):
 * wpis jest budowany, a `missingCoordinates` kaze operatorowi to poprawic.
 *
 * `unconfirmed` po edycjach: wlasciciel jest zrodlem faktu, wiec pole, ktore uzupelnil,
 * przestaje byc niepotwierdzone (zostaje w `changedByOwner`). Pole nadal puste zostaje.
 */

/** Pola, ktorych zmiane przez wlasciciela raportujemy operatorowi (R13). */
export const OWNER_EDITABLE_FIELDS = [...FACT_FIELDS, 'webpage', 'languages'] as const;
export type OwnerEditableField = (typeof OWNER_EDITABLE_FIELDS)[number];

/** Wejscie `serviceInputSchema` — dokladnie to, co operator zapisze jako plik. */
export type ServiceJson = z.input<typeof serviceInputSchema>;
type LocationJson = ServiceJson['locations'][number];

export interface BuildServiceJsonInput {
    stored: StoredDraft;
    edits: Omit<OwnerEdits, 'submitterEmail' | 'notes'>;
    /** Aktualne geokodowanie: `stored.geo` albo wynik relokacji / ponownego geokodowania. */
    geo: DraftGeo | null;
    hasLogo: boolean;
}

export type BuildServiceJsonResult =
    | {
          ok: true;
          json: ServiceJson;
          slug: string;
          unconfirmed: FactField[];
          changedByOwner: OwnerEditableField[];
          missingCoordinates: boolean;
      }
    | { ok: false; code: 'INVALID_ENTRY' };

type Edits = BuildServiceJsonInput['edits'];

function normalizeHours(hours: OpeningHours | null): string {
    if (hours === null) return '';
    return WEEKDAY_KEYS.map(day => {
        const entry = hours[day];
        return entry === undefined ? '' : `${entry.open}-${entry.close}`;
    }).join('|');
}

/** Wartosc pola sprowadzona do napisu, zeby porownanie ignorowalo kolejnosc i `null`/`{}`. */
function comparable(
    field: OwnerEditableField,
    source: DraftFacts | Edits,
    extra: {
        webpage: string | null;
        languages: readonly string[];
    },
): string {
    if (field === 'webpage') return extra.webpage ?? '';
    if (field === 'languages') return [...extra.languages].sort().join(',');
    if (field === 'openingHours') return normalizeHours(source.openingHours);
    return source[field]?.trim() ?? '';
}

function findChangedFields(stored: StoredDraft, edits: Edits): OwnerEditableField[] {
    const before = { webpage: stored.sourceUrl, languages: stored.draft.languages };
    const after = { webpage: edits.webpage, languages: edits.languages };

    return OWNER_EDITABLE_FIELDS.filter(
        field => comparable(field, stored.draft.facts, before) !== comparable(field, edits, after),
    );
}

function isFilled(field: FactField, edits: Edits): boolean {
    if (field === 'openingHours') return normalizeHours(edits.openingHours) !== '';
    return edits[field] !== null;
}

/**
 * Pliki w `data/services/` nie maja pustych kluczy, wiec pole `null` pomijamy zamiast
 * zapisywac `"street": null`. Schemat przyjmuje oba warianty.
 */
function buildLocation(edits: Edits, geo: DraftGeo | null): LocationJson {
    const postcode = edits.postcode ?? geo?.postcode ?? null;
    const hours = edits.openingHours;
    const hasHours = hours !== null && normalizeHours(hours) !== '';

    return {
        city: edits.city,
        ...(edits.street === null ? {} : { street: edits.street }),
        ...(geo?.voivodeship ? { voivodeship: geo.voivodeship } : {}),
        ...(postcode === null ? {} : { postcode }),
        ...(geo === null ? {} : { latitude: geo.lat, longitude: geo.lng }),
        ...(hasHours ? { openingHours: hours } : {}),
        ...(edits.phoneNumber === null ? {} : { phoneNumber: edits.phoneNumber }),
        ...(edits.email === null ? {} : { email: edits.email }),
        ...(edits.webpage === null ? {} : { webpage: edits.webpage }),
        isMainLocation: true,
    };
}

function isCoordinateIssue(issue: z.ZodIssue): boolean {
    const [root, , axis] = issue.path;
    return (
        issue.code === 'custom' &&
        root === 'locations' &&
        (axis === 'latitude' || axis === 'longitude')
    );
}

function invalidEntry(issues: string[]): BuildServiceJsonResult {
    // Sciezki i kody bez wartosci: wartosci to dane wlasciciela (PII).
    console.warn('add-business entry invalid', { issues });
    return { ok: false, code: 'INVALID_ENTRY' };
}

export function buildServiceJson(input: BuildServiceJsonInput): BuildServiceJsonResult {
    const { stored, edits, geo, hasLogo } = input;
    const { draft } = stored;

    const slug = buildServiceSlug(edits.name);
    if (slug === '') return invalidEntry(['name:empty_slug']);

    const json: ServiceJson = {
        name: edits.name,
        category: draft.category,
        coverage: draft.coverage,
        status: 'active',
        verified: false,
        ...(hasLogo ? { image: `${slug}.png` } : {}),
        languages: edits.languages,
        translations: {
            pl: { description: draft.descriptions.pl },
            uk: { description: draft.descriptions.uk },
            en: { description: draft.descriptions.en },
            ru: { description: draft.descriptions.ru },
        },
        tags: draft.tags,
        locations: [buildLocation(edits, geo)],
    };

    const missingCoordinates = draft.coverage !== 'online' && geo === null;
    const parsed = serviceInputSchema.safeParse(json);
    if (!parsed.success) {
        const unexpected = parsed.error.issues.filter(
            issue => !(missingCoordinates && isCoordinateIssue(issue)),
        );
        if (unexpected.length > 0) {
            return invalidEntry(unexpected.map(issue => `${issue.path.join('.')}:${issue.code}`));
        }
    }

    return {
        ok: true,
        json,
        slug,
        unconfirmed: draft.unconfirmed.filter(field => !isFilled(field, edits)),
        changedByOwner: findChangedFields(stored, edits),
        missingCoordinates,
    };
}
