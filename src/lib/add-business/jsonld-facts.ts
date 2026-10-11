import { z } from 'zod';

import { type LocationInput, WEEKDAY_KEYS } from '@/db/service-input-schema';

/**
 * Fakty strukturalne z blokow JSON-LD (schema.org). Kazde pole walidujemy
 * osobno: zepsuty `geo` nie kasuje poprawnego telefonu. Pole, ktore nie
 * przeszlo walidacji, po prostu nie trafia do wyniku (R4 — nie zgadujemy).
 */

export type OpeningHours = LocationInput['openingHours'];

export interface StructuredAddress {
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
    /** Adres podany jako jeden napis zamiast `PostalAddress`. */
    raw?: string;
}

export interface StructuredFacts {
    name?: string;
    address?: StructuredAddress;
    telephone?: string;
    email?: string;
    geo?: { latitude: number; longitude: number };
    /** Klucze `monday`…`sunday`, godziny `HH:MM` — ksztalt `serviceInputSchema`. */
    openingHours?: OpeningHours;
    sameAs?: string[];
}

type JsonObject = Record<string, unknown>;

const WEEKDAYS: ReadonlySet<string> = new Set<string>(WEEKDAY_KEYS);
/**
 * Wzorzec PARSOWANIA godziny schema.org (`9:00`, `09:00:00`) — luzniejszy niz kanoniczny
 * `TIME_PATTERN` z `service-input-schema.ts`; `normalizeTime` sprowadza wynik do `HH:MM`.
 */
const SCHEMA_ORG_TIME_PATTERN = /^(\d{1,2}):([0-5]\d)/;

/**
 * Podtypy `LocalBusiness` spotykane w katalogu. Pelna lista schema.org ma setki
 * typow, wiec dodatkowo wezel z `geo` albo `openingHoursSpecification` uznajemy
 * za lokalna firme niezaleznie od nazwy typu.
 */
const LOCAL_BUSINESS_TYPES = new Set([
    'LocalBusiness',
    'ProfessionalService',
    'LegalService',
    'Attorney',
    'Notary',
    'MedicalBusiness',
    'MedicalClinic',
    'Dentist',
    'Physician',
    'Pharmacy',
    'Optician',
    'HealthAndBeautyBusiness',
    'BeautySalon',
    'HairSalon',
    'NailSalon',
    'DaySpa',
    'FinancialService',
    'AccountingService',
    'InsuranceAgency',
    'RealEstateAgent',
    'TravelAgency',
    'EmploymentAgency',
    'ChildCare',
    'Store',
    'FoodEstablishment',
    'Restaurant',
    'CafeOrCoffeeShop',
    'Bakery',
    'AutomotiveBusiness',
    'AutoRepair',
    'HomeAndConstructionBusiness',
    'MovingCompany',
    'DryCleaningOrLaundry',
    'LodgingBusiness',
    'Hotel',
    'SportsActivityLocation',
    'ExerciseGym',
    'EntertainmentBusiness',
]);

const ORGANIZATION_TYPES = new Set([
    'Organization',
    'Corporation',
    'NGO',
    'NonprofitOrganization',
    'EducationalOrganization',
    'MedicalOrganization',
]);

const textSchema = z.string().trim().min(1).max(255);
const phoneSchema = z.string().trim().min(3).max(50);
const emailSchema = z.preprocess(
    value => (typeof value === 'string' ? value.replace(/^mailto:/i, '') : value),
    z.string().trim().email().max(255),
);
const httpUrlSchema = z
    .string()
    .trim()
    .url()
    .regex(/^https?:\/\//i);
const coordinate = (limit: number): z.ZodType<number, z.ZodTypeDef, unknown> =>
    z.preprocess(
        value => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
        z.number().min(-limit).max(limit),
    );
const geoSchema = z.object({ latitude: coordinate(90), longitude: coordinate(180) });
const countrySchema = z.union([textSchema, z.object({ name: textSchema }).transform(c => c.name)]);

function pick<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown): T | undefined {
    if (value === undefined) return undefined;
    const result = schema.safeParse(value);
    return result.success ? result.data : undefined;
}

function isRecord(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Splaszcza tablice i `@graph` (rekurencyjnie) do listy wezlow. */
function flattenNodes(value: unknown): JsonObject[] {
    if (Array.isArray(value)) return value.flatMap(flattenNodes);
    if (!isRecord(value)) return [];
    const graph = value['@graph'];
    return graph === undefined ? [value] : flattenNodes(graph);
}

function toList(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [value];
}

/** 0 = lokalna firma, 1 = organizacja, undefined = wezel nie opisuje firmy. */
function businessRank(node: JsonObject): number | undefined {
    const types = toList(node['@type']).filter(type => typeof type === 'string');
    if (types.some(type => LOCAL_BUSINESS_TYPES.has(type))) return 0;
    if (node.geo !== undefined || node.openingHoursSpecification !== undefined) return 0;
    if (types.some(type => ORGANIZATION_TYPES.has(type))) return 1;
    return undefined;
}

function parseAddress(value: unknown): StructuredAddress | undefined {
    const raw = pick(textSchema, value);
    if (raw !== undefined) return { raw };
    if (!isRecord(value)) return undefined;

    const address: StructuredAddress = {
        street: pick(textSchema, value.streetAddress),
        city: pick(textSchema, value.addressLocality),
        postcode: pick(z.string().trim().min(1).max(20), value.postalCode),
        country: pick(countrySchema, value.addressCountry),
    };
    return Object.values(address).some(field => field !== undefined) ? address : undefined;
}

function normalizeDay(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    // "Monday", "https://schema.org/Monday", "http://schema.org/Monday"
    const day = value.slice(value.lastIndexOf('/') + 1).toLowerCase();
    return WEEKDAYS.has(day) ? day : undefined;
}

function normalizeTime(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const match = SCHEMA_ORG_TIME_PATTERN.exec(value.trim());
    if (!match) return undefined;
    const hours = Number(match[1]);
    return hours <= 23 ? `${String(hours).padStart(2, '0')}:${match[2]}` : undefined;
}

/** `openingHoursSpecification` → `{ monday: { open, close } }`. Wpis bez dnia lub godzin pomijamy. */
export function mapOpeningHours(specification: unknown): OpeningHours {
    const hours: OpeningHours = {};
    for (const entry of toList(specification)) {
        if (!isRecord(entry)) continue;
        const open = normalizeTime(entry.opens);
        const close = normalizeTime(entry.closes);
        if (!open || !close) continue;
        for (const day of toList(entry.dayOfWeek).map(normalizeDay)) {
            if (day) hours[day] = { open, close };
        }
    }
    return hours;
}

function parseSameAs(value: unknown): string[] | undefined {
    const urls = toList(value)
        .map(item => pick(httpUrlSchema, item))
        .filter(url => url !== undefined);
    return urls.length > 0 ? urls : undefined;
}

function factsFromNode(node: JsonObject): StructuredFacts {
    const openingHours = mapOpeningHours(node.openingHoursSpecification);
    return {
        name: pick(textSchema, node.name),
        address: parseAddress(node.address),
        telephone: pick(phoneSchema, node.telephone),
        email: pick(emailSchema, node.email),
        geo: pick(geoSchema, node.geo),
        openingHours: Object.keys(openingHours).length > 0 ? openingHours : undefined,
        sameAs: parseSameAs(node.sameAs),
    };
}

/** Pierwsza zdefiniowana wartosc wygrywa — wezly sa posortowane od najbardziej konkretnego. */
export function mergeFacts(all: StructuredFacts[]): StructuredFacts {
    const merged: StructuredFacts = {};
    for (const facts of all) {
        merged.name ??= facts.name;
        merged.address ??= facts.address;
        merged.telephone ??= facts.telephone;
        merged.email ??= facts.email;
        merged.geo ??= facts.geo;
        merged.openingHours ??= facts.openingHours;
        merged.sameAs ??= facts.sameAs;
    }
    return merged;
}

function parseBlock(block: string, index: number): unknown {
    try {
        return JSON.parse(block);
    } catch (error) {
        // Zepsuty blok to norma na stronach z wtyczkami SEO — logujemy i idziemy dalej.
        console.warn('JSON-LD block skipped', {
            index,
            reason: error instanceof Error ? error.message : 'unknown',
        });
        return undefined;
    }
}

/** Fakty z tresci blokow `<script type="application/ld+json">`. Nigdy nie rzuca. */
export function extractJsonLdFacts(blocks: string[]): StructuredFacts {
    const ranked = blocks
        .flatMap((block, index) => flattenNodes(parseBlock(block, index)))
        .map(node => ({ node, rank: businessRank(node) }))
        .filter(entry => entry.rank !== undefined)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

    return mergeFacts(ranked.map(entry => factsFromNode(entry.node)));
}
