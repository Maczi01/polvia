import { z } from 'zod';

import type { OpeningHours } from '@/lib/add-business/jsonld-facts';
import { type Category, CATEGORY_VALUES } from '@/lib/categories';
import { type Coverage, coverageEnum } from '@/db/schema';
import type { TagInput } from '@/db/service-input-schema';

/**
 * Kontrakt odpowiedzi modelu przy generowaniu szkicu wpisu (D3).
 *
 * Dwa opisy tego samego ksztaltu w jednym pliku:
 * - `DRAFT_JSON_SCHEMA` idzie do OpenAI jako `response_format` (strict mode: wszystkie pola
 *   wymagane, opcjonalnosc przez `null`, `additionalProperties: false`);
 * - `llmDraftSchema` waliduje to, co wrocilo — strict mode nie zwalnia z `safeParse`.
 *
 * Schemat JSON jest pisany recznie, bo `zodResponseFormat` z SDK emituje dla `.nullable()`
 * nieprzenosne `nullable: true` i duplikuje definicje przez `$ref`.
 *
 * Bez `minItems`/`maxLength` w schemacie JSON: nie kazdy snapshot je akceptuje w strict mode.
 * Liczbe tagow pilnuje `llmDraftSchema`.
 */

/** Jezyki obslugi klienta — te same kody co locale katalogu (`klasyfikacja.md`). */
export const LANGUAGE_CODES = ['pl', 'uk', 'en', 'ru'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const WEEKDAY_KEYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
] as const;

export const MIN_TAGS = 3;
export const MAX_TAGS = 5;

const localizedTextSchema = z
    .object({
        pl: z.string().min(1),
        uk: z.string().min(1),
        en: z.string().min(1),
        ru: z.string().min(1),
    })
    .strict();

const dayHoursSchema = z.object({ open: z.string(), close: z.string() }).strict().nullable();

const llmOpeningHoursSchema = z
    .object({
        monday: dayHoursSchema,
        tuesday: dayHoursSchema,
        wednesday: dayHoursSchema,
        thursday: dayHoursSchema,
        friday: dayHoursSchema,
        saturday: dayHoursSchema,
        sunday: dayHoursSchema,
    })
    .strict();

export type LlmOpeningHours = z.infer<typeof llmOpeningHoursSchema>;

export const llmDraftSchema = z
    .object({
        category: z.enum(CATEGORY_VALUES),
        coverage: z.enum(coverageEnum.enumValues),
        languages: z.array(z.enum(LANGUAGE_CODES)),
        tags: z.array(localizedTextSchema).min(MIN_TAGS).max(MAX_TAGS),
        descriptions: localizedTextSchema,
        name: z.string().nullable(),
        street: z.string().nullable(),
        postcode: z.string().nullable(),
        city: z.string().nullable(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        openingHours: llmOpeningHoursSchema.nullable(),
    })
    .strict();

export type LlmDraft = z.infer<typeof llmDraftSchema>;

/** Fakty kandydujace z odpowiedzi modelu — wejscie `verifyFacts`. */
export type LlmFacts = Pick<
    LlmDraft,
    'name' | 'street' | 'postcode' | 'city' | 'phone' | 'email' | 'openingHours'
>;

const nullableString = { type: ['string', 'null'] } as const;

function objectSchema(properties: Record<string, unknown>): Record<string, unknown> {
    return {
        type: 'object',
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
    };
}

const localizedTextJsonSchema = objectSchema({
    pl: { type: 'string' },
    uk: { type: 'string' },
    en: { type: 'string' },
    ru: { type: 'string' },
});

const dayHoursJsonSchema = {
    anyOf: [
        objectSchema({ open: { type: 'string' }, close: { type: 'string' } }),
        { type: 'null' },
    ],
};

export const DRAFT_JSON_SCHEMA: Record<string, unknown> = objectSchema({
    category: { type: 'string', enum: [...CATEGORY_VALUES] },
    coverage: { type: 'string', enum: [...coverageEnum.enumValues] },
    languages: { type: 'array', items: { type: 'string', enum: [...LANGUAGE_CODES] } },
    tags: { type: 'array', items: localizedTextJsonSchema },
    descriptions: localizedTextJsonSchema,
    name: nullableString,
    street: nullableString,
    postcode: nullableString,
    city: nullableString,
    phone: nullableString,
    email: nullableString,
    openingHours: {
        anyOf: [
            objectSchema(Object.fromEntries(WEEKDAY_KEYS.map(day => [day, dayHoursJsonSchema]))),
            { type: 'null' },
        ],
    },
});

/**
 * Nazwy pol faktow = nazwy pol `LocationInput` / `serviceInputSchema` (`name` jest na
 * poziomie wpisu, reszta w `locations[0]`). Dzieki temu `unconfirmed` mapuje sie na pola
 * formularza i JSON-a dla `db:add` bez tlumaczenia nazw.
 */
export const FACT_FIELDS = [
    'name',
    'street',
    'postcode',
    'city',
    'phoneNumber',
    'email',
    'openingHours',
] as const;

export type FactField = (typeof FACT_FIELDS)[number];

export interface DraftFacts {
    name: string | null;
    street: string | null;
    postcode: string | null;
    city: string | null;
    phoneNumber: string | null;
    email: string | null;
    /** Ksztalt `serviceInputSchema`: dzien nieczynny pominiety, godziny `HH:MM`. */
    openingHours: OpeningHours | null;
}

export interface LocalizedText {
    pl: string;
    uk: string;
    en: string;
    ru: string;
}

/**
 * Szkic wpisu. `category`, `coverage`, `languages`, `tags`, `descriptions` pochodza od
 * modelu i nie sa edytowalne przez wlasciciela (R9). `facts` przeszly weryfikacje (D4);
 * pole, ktorego nie dalo sie potwierdzic, ma `null` i jest w `unconfirmed` (R4).
 */
export interface BusinessDraft {
    category: Category;
    coverage: Coverage;
    languages: LanguageCode[];
    tags: TagInput[];
    descriptions: LocalizedText;
    facts: DraftFacts;
    unconfirmed: FactField[];
}
