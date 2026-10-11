import { WEEKDAY_KEYS } from '@/db/service-input-schema';

import {
    type DraftFacts,
    FACT_FIELDS,
    type FactField,
    type LlmFacts,
    type LlmOpeningHours,
} from './draft-schema';
import type { OpeningHours, StructuredFacts } from './jsonld-facts';

/**
 * Jedyna bariera przed wymyslonymi danymi (D4, R4): JSON-LD > fakt modelu potwierdzony
 * w tekscie zrodla > `null` + wpis w `unconfirmed`.
 */

export interface VerifyFactsInput {
    structured: StructuredFacts;
    llm: LlmFacts;
    sourceText: string;
}

export interface VerifiedFacts {
    facts: DraftFacts;
    unconfirmed: FactField[];
}

/** Ciag, ktory moze byc numerem telefonu: cyfry z separatorami, co najmniej 9 znakow. */
const PHONE_CANDIDATE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

/** Numer krajowy: same cyfry bez prefiksu `+48` / `0048` / `48` przed 9 cyframi. */
function nationalDigits(phone: string): string {
    const digits = phone.replaceAll(/\D/g, '');
    const withoutZeros = digits.startsWith('0048') ? digits.slice(2) : digits;
    return withoutZeros.length === 11 && withoutZeros.startsWith('48')
        ? withoutZeros.slice(2)
        : withoutZeros;
}

function verifyPhone(phone: string | null, sourceText: string): string | null {
    if (phone === null) return null;
    const wanted = nationalDigits(phone);
    if (wanted.length < 9) return null;

    const found = (sourceText.match(PHONE_CANDIDATE_PATTERN) ?? []).map(nationalDigits);
    return found.includes(wanted) ? phone.trim() : null;
}

const EMAIL_PATTERN = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/g;

function verifyEmail(email: string | null, sourceText: string): string | null {
    if (email === null) return null;
    const wanted = email.trim().toLowerCase();

    const found = (sourceText.match(EMAIL_PATTERN) ?? []).map(match => match.toLowerCase());
    return found.includes(wanted) ? wanted : null;
}

function normalizeText(value: string): string {
    return value.replaceAll(/\s+/g, ' ').trim().toLocaleLowerCase('pl');
}

/** Wartosc tekstowa przechodzi, gdy po normalizacji wystepuje doslownie w zrodle. */
function verifyText(value: string | null, normalizedSource: string): string | null {
    if (value === null) return null;
    const cleaned = value.replaceAll(/\s+/g, ' ').trim();
    if (cleaned === '') return null;

    return normalizedSource.includes(normalizeText(cleaned)) ? cleaned : null;
}

const MODEL_TIME_PATTERN = /^(\d{1,2}):([0-5]\d)$/;
/** Godzina w tekscie: `9:00`, `09:00`, `9.00`. Zapis `9-17` bez minut nie potwierdza niczego. */
const SOURCE_TIME_PATTERN = /\b(\d{1,2})[.:]([0-5]\d)\b/g;
const LAST_HOUR = 23;

function toTime(hours: string, minutes: string): string | null {
    return Number(hours) > LAST_HOUR ? null : `${hours.padStart(2, '0')}:${minutes}`;
}

function parseModelTime(value: string): string | null {
    const match = MODEL_TIME_PATTERN.exec(value.trim());
    return match ? toTime(match[1], match[2]) : null;
}

/**
 * Godziny przechodza w calosci albo wcale: kazda godzina otwarcia i zamkniecia musi
 * wystapic w zrodle. Dni nie da sie potwierdzic tekstowo ("Pn-Pt"), wiec przypisanie
 * dni bierzemy od modelu — wlasciciel widzi je w podgladzie i moze poprawic.
 */
function verifyOpeningHours(
    hours: LlmOpeningHours | null,
    sourceText: string,
): OpeningHours | null {
    if (hours === null) return null;

    const sourceTimes = new Set(
        [...sourceText.matchAll(SOURCE_TIME_PATTERN)].map(match => toTime(match[1], match[2])),
    );
    const isConfirmed = (time: string | null): time is string =>
        time !== null && sourceTimes.has(time);

    const verified: OpeningHours = {};
    for (const day of WEEKDAY_KEYS) {
        const dayHours = hours[day];
        if (dayHours === null) continue;

        const open = parseModelTime(dayHours.open);
        const close = parseModelTime(dayHours.close);
        if (!isConfirmed(open) || !isConfirmed(close)) return null;
        verified[day] = { open, close };
    }

    return Object.keys(verified).length > 0 ? verified : null;
}

function pick<T>(fromStructured: T | undefined, fromLlm: () => T | null): T | null {
    return fromStructured === undefined ? fromLlm() : fromStructured;
}

export function verifyFacts({ structured, llm, sourceText }: VerifyFactsInput): VerifiedFacts {
    // Adres z JSON-LD podany jednym napisem nie trafia do tekstu strony, a model go widzi.
    const normalizedSource = normalizeText(`${sourceText}\n${structured.address?.raw ?? ''}`);
    const address = structured.address ?? {};

    const facts: DraftFacts = {
        name: pick(structured.name, () => verifyText(llm.name, normalizedSource)),
        street: pick(address.street, () => verifyText(llm.street, normalizedSource)),
        postcode: pick(address.postcode, () => verifyText(llm.postcode, normalizedSource)),
        city: pick(address.city, () => verifyText(llm.city, normalizedSource)),
        phoneNumber: pick(structured.telephone, () => verifyPhone(llm.phone, sourceText)),
        email: pick(structured.email, () => verifyEmail(llm.email, sourceText)),
        openingHours: pick(structured.openingHours, () =>
            verifyOpeningHours(llm.openingHours, sourceText),
        ),
    };

    const unconfirmed = FACT_FIELDS.filter(field => facts[field] === null);
    return { facts, unconfirmed };
}
