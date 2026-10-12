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

/**
 * Ciag grup cyfr rozdzielonych wylacznie separatorami zapisu telefonu. Cyfry i separatory to
 * rozlaczne klasy znakow, wiec dopasowanie jest liniowe (bez katastrofalnego backtrackingu).
 */
const DIGIT_GROUP_RUN_PATTERN = /\d+(?:[\s().+-]+\d+)*/g;
const DIGIT_GROUP_PATTERN = /\d+/g;
/** Telefon od modelu moze zawierac tylko cyfry i separatory zapisu — zadnego doklejonego tekstu. */
const PHONE_VALUE_PATTERN = /^[\d\s()+.-]+$/;
const NATIONAL_PHONE_LENGTH = 9;
/** `0048` + 9 cyfr — dluzsze okno nie moze juz dac numeru krajowego. */
const MAX_PHONE_WINDOW_DIGITS = 13;
/** Najdluzszy sensowny zapis numeru w grupach: `+48 22 123 45 67` to 5 grup, z zapasem 6. */
const MAX_PHONE_WINDOW_GROUPS = 6;

/** Numer krajowy: same cyfry bez prefiksu `+48` / `0048` / `48` przed 9 cyframi. */
function nationalDigits(phone: string): string {
    const digits = phone.replaceAll(/\D/g, '');
    const withoutZeros = digits.startsWith('0048') ? digits.slice(2) : digits;
    return withoutZeros.length === 11 && withoutZeros.startsWith('48')
        ? withoutZeros.slice(2)
        : withoutZeros;
}

/** Numery krajowe z okien zaczynajacych sie od grupy `start` (najwyzej 6 grup, 13 cyfr). */
function phonesStartingAt(groups: string[], start: number): string[] {
    const phones: string[] = [];
    const end = Math.min(groups.length, start + MAX_PHONE_WINDOW_GROUPS);
    let window = '';
    for (let index = start; index < end && window.length < MAX_PHONE_WINDOW_DIGITS; index++) {
        window += groups[index];
        const national = nationalDigits(window);
        if (national.length === NATIONAL_PHONE_LENGTH) phones.push(national);
    }
    return phones;
}

/**
 * Numery krajowe z okien sasiednich grup cyfr w obrebie jednego ciagu. Okna rozdzielaja
 * numery stojace obok siebie ("22 123 45 67 600 700 800") i numer od kodu pocztowego.
 */
function phonesInSource(sourceText: string): Set<string> {
    const runs = sourceText.match(DIGIT_GROUP_RUN_PATTERN) ?? [];
    return new Set(
        runs.flatMap(run => {
            const groups = run.match(DIGIT_GROUP_PATTERN) ?? [];
            return groups.flatMap((_, start) => phonesStartingAt(groups, start));
        }),
    );
}

function verifyPhone(phone: string | null, sourceText: string): string | null {
    if (phone === null || !PHONE_VALUE_PATTERN.test(phone)) return null;
    const wanted = nationalDigits(phone);
    if (wanted.length !== NATIONAL_PHONE_LENGTH) return null;

    return phonesInSource(sourceText).has(wanted) ? phone.trim() : null;
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

/**
 * Najkrotsza wartosc tekstowa warta potwierdzania. Najkrotsze polskie nazwy miejscowosci maja
 * 3 litery (Ełk, Ryn), a krotsze wartosci ("a", "ul", "nr") wystepuja w prawie kazdym tekscie
 * jako osobne slowo, wiec ich obecnosc niczego nie potwierdza. Dwuznakowa nazwa firmy trafi
 * do `unconfirmed` i wlasciciel wpisze ja sam — blad w bezpieczna strone.
 */
const MIN_TEXT_FACT_LENGTH = 3;
const POSTCODE_PATTERN = /^\d{2}-\d{3}$/;
const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value: string): string {
    return value.replaceAll(REGEX_SPECIAL_CHARS, String.raw`\$&`);
}

/** Calym slowem: przed i po wartosci nie moze stac litera ani cyfra (takze z diakrytykami). */
function containsWholeWord(normalizedSource: string, normalizedValue: string): boolean {
    const pattern = new RegExp(
        String.raw`(?<![\p{L}\p{N}])${escapeRegex(normalizedValue)}(?![\p{L}\p{N}])`,
        'u',
    );
    return pattern.test(normalizedSource);
}

/** Wartosc tekstowa przechodzi, gdy po normalizacji wystepuje w zrodle jako cale slowo/fraza. */
function verifyText(value: string | null, normalizedSource: string): string | null {
    if (value === null) return null;
    const cleaned = value.replaceAll(/\s+/g, ' ').trim();
    if (cleaned.length < MIN_TEXT_FACT_LENGTH) return null;

    return containsWholeWord(normalizedSource, normalizeText(cleaned)) ? cleaned : null;
}

function verifyPostcode(value: string | null, normalizedSource: string): string | null {
    if (value === null || !POSTCODE_PATTERN.test(value.trim())) return null;
    return verifyText(value, normalizedSource);
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
        postcode: pick(address.postcode, () => verifyPostcode(llm.postcode, normalizedSource)),
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
