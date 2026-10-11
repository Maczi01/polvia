import { z } from 'zod';

import { openingHoursSchema, tagInputSchema, WEEKDAY_KEYS } from '@/db/service-input-schema';
import { CATEGORY_VALUES } from '@/lib/categories';
import { COVERAGE_VALUES } from '@/lib/coverage';

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
 *
 * `businessDraftSchema` to kontrakt szkicu PO weryfikacji faktow — jedyny schemat szkicu,
 * ktorym `draft-store` waliduje zapis i odczyt z Redisa. Ksztalty wspolne z plikiem wpisu
 * (tag, godziny otwarcia) pochodza z `service-input-schema.ts`, zeby szkic nie przepuscil
 * niczego, co odrzuci `db:add`.
 *
 * Modul nie importuje `@/db/schema` (drizzle `pg-core`) — nadaje sie do walidacji klienckiej.
 */

/** Jezyki obslugi klienta — te same kody co locale katalogu (`klasyfikacja.md`). */
export const LANGUAGE_CODES = ['pl', 'uk', 'en', 'ru'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const MIN_TAGS = 3;
export const MAX_TAGS = 5;

/** Tekst w czterech jezykach katalogu — ten sam ksztalt co tag w pliku wpisu. */
const localizedTextSchema = tagInputSchema;

export type LocalizedText = z.infer<typeof localizedTextSchema>;

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
        coverage: z.enum(COVERAGE_VALUES),
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
    coverage: { type: 'string', enum: [...COVERAGE_VALUES] },
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

const draftFactsSchema = z
    .object({
        name: z.string().nullable(),
        street: z.string().nullable(),
        postcode: z.string().nullable(),
        city: z.string().nullable(),
        phoneNumber: z.string().nullable(),
        email: z.string().nullable(),
        /** Ksztalt `serviceInputSchema`: dzien nieczynny pominiety, godziny `HH:MM`. */
        openingHours: openingHoursSchema.nullable(),
    })
    .strict();

export type DraftFacts = z.infer<typeof draftFactsSchema>;

/**
 * Szkic wpisu. `category`, `coverage`, `tags`, `descriptions` pochodza od modelu i nie sa
 * edytowalne przez wlasciciela (R9); `languages` to propozycja modelu, ktora wlasciciel moze
 * poprawic. `facts` przeszly weryfikacje (D4);
 * pole, ktorego nie dalo sie potwierdzic, ma `null` i jest w `unconfirmed` (R4).
 */
export const businessDraftSchema = z
    .object({
        category: z.enum(CATEGORY_VALUES),
        coverage: z.enum(COVERAGE_VALUES),
        languages: z.array(z.enum(LANGUAGE_CODES)),
        tags: z.array(tagInputSchema).min(MIN_TAGS).max(MAX_TAGS),
        descriptions: localizedTextSchema,
        facts: draftFactsSchema,
        unconfirmed: z.array(z.enum(FACT_FIELDS)),
    })
    .strict();

export type BusinessDraft = z.infer<typeof businessDraftSchema>;
