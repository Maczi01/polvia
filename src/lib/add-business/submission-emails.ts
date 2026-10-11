import 'server-only';

import { createTranslator } from 'next-intl';

import type { Locale } from '@/i18n/config';
import type { BuildServiceJsonResult, ServiceJson } from '@/lib/add-business/build-service-json';
import { LANGUAGE_CODES, type LanguageCode, WEEKDAY_KEYS } from '@/lib/add-business/draft-schema';
import type { StoredDraft } from '@/lib/add-business/draft-store';
import { getOperatorInbox, type MailMessage, toHeaderText } from '@/lib/mailer';

import en from '../../../messages/en.json';
import pl from '../../../messages/pl.json';
import ru from '../../../messages/ru.json';
import uk from '../../../messages/uk.json';

/**
 * Tresc obu maili po wysylce zgloszenia (R13, R15). Funkcje sa czyste: zwracaja
 * `MailMessage`, a wysyla je wolajacy przez `sendMail` z `@/lib/mailer`.
 *
 * Semantyka bledow nalezy do wolajacego (U8):
 * - `sendMail(buildOperatorEmail(input))` z `ok: false` = blad submitu `SEND_FAILED`;
 *   szkic jest juz skonsumowany, wiec `entry.json` trzeba zalogowac w calosci;
 * - `sendMail(buildOwnerConfirmationEmail(input))` z `ok: false` = tylko log, sukces zostaje.
 *
 * Tlumaczenia potwierdzenia czytamy z `messages/*.json` przez `createTranslator` — te same
 * pliki co `src/i18n/request.ts`, ale bez zaleznosci od kontekstu requestu next-intl.
 */

export type BuiltServiceEntry = Extract<BuildServiceJsonResult, { ok: true }>;

export interface SubmissionEmailInput {
    entry: BuiltServiceEntry;
    stored: Pick<StoredDraft, 'locale' | 'source' | 'sourceUrl'>;
    submitterEmail: string;
    notes: string | null;
    /** PNG po `processLogoUpload` / `processLogoCandidate`; `null` = brak logo. */
    logo: Buffer | null;
}

type Location = ServiceJson['locations'][number];
type Hours = NonNullable<Location['openingHours']>;
type Weekday = (typeof WEEKDAY_KEYS)[number];

const MESSAGES = { pl, en, ru, uk } satisfies Record<Locale, unknown>;

const FIELD_LABELS: Record<BuiltServiceEntry['changedByOwner'][number], string> = {
    name: 'Nazwa (name)',
    street: 'Ulica (street)',
    postcode: 'Kod pocztowy (postcode)',
    city: 'Miasto (city)',
    phoneNumber: 'Telefon (phoneNumber)',
    email: 'E-mail (email)',
    openingHours: 'Godziny otwarcia (openingHours)',
    webpage: 'Strona (webpage)',
    languages: 'Języki (languages)',
};

const OPERATOR_DAY_LABELS: Record<Weekday, string> = {
    monday: 'pn',
    tuesday: 'wt',
    wednesday: 'śr',
    thursday: 'cz',
    friday: 'pt',
    saturday: 'sb',
    sunday: 'nd',
};

const NONE = '(brak)';

const LANGUAGE_CODE_SET: ReadonlySet<string> = new Set(LANGUAGE_CODES);

function isLanguageCode(value: string): value is LanguageCode {
    return LANGUAGE_CODE_SET.has(value);
}

function formatAddress(location: Location | undefined): string | null {
    if (location === undefined) return null;
    const cityLine = [location.postcode, location.city].filter(Boolean).join(' ');
    return [location.street, cityLine].filter(Boolean).join(', ');
}

function formatHours(hours: Hours | undefined, dayLabel: (day: Weekday) => string): string[] {
    if (hours === undefined) return [];
    return WEEKDAY_KEYS.flatMap(day => {
        const entry = hours[day];
        return entry === undefined ? [] : [`${dayLabel(day)}: ${entry.open}-${entry.close}`];
    });
}

function section(title: string, lines: string[]): string {
    return [`== ${title} ==`, ...(lines.length > 0 ? lines : [NONE])].join('\n');
}

function line(label: string, value: string | null | undefined): string {
    return `${label}: ${value || NONE}`;
}

function bulletList(items: string[]): string[] {
    return items.map(item => `- ${item}`);
}

function operatorCardLines(json: ServiceJson): string[] {
    const [location] = json.locations;
    const hours = formatHours(location?.openingHours, day => OPERATOR_DAY_LABELS[day]);
    return [
        line('Nazwa', json.name),
        line('Adres', formatAddress(location)),
        line('Telefon', location?.phoneNumber),
        line('E-mail', location?.email),
        line('Strona', location?.webpage),
        line('Języki', json.languages?.join(', ')),
        line('Godziny', hours.join(', ')),
        '',
        line('Kategoria', json.category),
        line('Zasięg', json.coverage),
        'Tagi (pl | uk | en | ru):',
        ...bulletList((json.tags ?? []).map(tag => [tag.pl, tag.uk, tag.en, tag.ru].join(' | '))),
        '',
        `Opis (pl): ${json.translations.pl.description}`,
    ];
}

function warningSections({ entry, logo }: SubmissionEmailInput): string[] {
    const warnings: string[] = [];
    if (entry.missingCoordinates) {
        warnings.push(
            section('Brak współrzędnych', [
                'Geokoder nie trafił — uzupełnij latitude/longitude przed db:add.',
            ]),
        );
    }
    if (logo === null) {
        warnings.push(section('Brak logo', ['Zgłoszenie bez logo — karta użyje /default.png.']));
    }
    return warnings;
}

function sourceLines({ stored, submitterEmail }: SubmissionEmailInput): string[] {
    const mode = stored.source === 'page' ? 'strona (szkic z linku)' : 'ręczny (bez strony)';
    return [
        line('Tryb', mode),
        line('Link źródłowy', stored.sourceUrl),
        line('Locale zgłoszenia', stored.locale),
        line('Zgłaszający', submitterEmail),
    ];
}

function operatorText(input: SubmissionEmailInput): string {
    const { entry, notes, logo } = input;
    const jsonPath = `data/services/${entry.slug}.json`;
    const instructions = [
        `1. Zapisz załącznik ${entry.slug}.json jako ${jsonPath}`,
        ...(logo === null
            ? []
            : [`2. Zapisz załącznik ${entry.slug}.png jako public/services/${entry.slug}.png`]),
        `${logo === null ? 2 : 3}. Sprawdź wpis:`,
        `npm run db:add -- ${jsonPath} --dry-run`,
    ];

    return [
        'Nowe zgłoszenie firmy z formularza „Dodaj firmę”.',
        section('Karta', operatorCardLines(entry.json)),
        section('Niepotwierdzone', bulletList(entry.unconfirmed.map(field => FIELD_LABELS[field]))),
        section(
            'Zmienione przez właściciela',
            bulletList(entry.changedByOwner.map(field => FIELD_LABELS[field])),
        ),
        ...warningSections(input),
        section('Uwagi', notes === null ? [] : [notes]),
        section('Źródło', sourceLines(input)),
        section('Dodanie do katalogu', instructions),
    ].join('\n\n');
}

export function buildOperatorEmail(input: SubmissionEmailInput): MailMessage {
    const { entry, submitterEmail, logo } = input;
    const attachments: NonNullable<MailMessage['attachments']> = [
        {
            filename: `${entry.slug}.json`,
            content: JSON.stringify(entry.json, null, 4),
            contentType: 'application/json',
        },
        ...(logo === null
            ? []
            : [{ filename: `${entry.slug}.png`, content: logo, contentType: 'image/png' }]),
    ];

    return {
        to: getOperatorInbox(),
        replyTo: submitterEmail,
        // `sendMail` i tak czysci naglowek; tu, zeby wiadomosc byla poprawna sama w sobie.
        subject: toHeaderText(`[Polvia] Zgłoszenie: ${entry.json.name}`),
        text: operatorText(input),
        attachments,
    };
}

function confirmationTranslator(locale: Locale) {
    return createTranslator({
        locale,
        messages: MESSAGES[locale],
        namespace: 'addBusiness.confirmationEmail',
    });
}

export function buildOwnerConfirmationEmail(input: SubmissionEmailInput): MailMessage {
    const { entry, stored, submitterEmail } = input;
    const t = confirmationTranslator(stored.locale);
    const { json } = entry;
    const [location] = json.locations;
    const name = json.name;

    const hours = formatHours(location?.openingHours, day => t(`days.${day}`));
    const languages = (json.languages ?? []).map(code =>
        isLanguageCode(code) ? t(`languages.${code}`) : code,
    );
    const facts = [
        line(t('fields.name'), name),
        line(t('fields.address'), formatAddress(location)),
        ...(location?.phoneNumber ? [line(t('fields.phone'), location.phoneNumber)] : []),
        ...(location?.email ? [line(t('fields.email'), location.email)] : []),
        ...(location?.webpage ? [line(t('fields.webpage'), location.webpage)] : []),
        ...(hours.length > 0 ? [`${t('fields.openingHours')}:`, ...bulletList(hours)] : []),
        ...(languages.length > 0 ? [line(t('fields.languages'), languages.join(', '))] : []),
    ];

    return {
        to: submitterEmail,
        subject: toHeaderText(t('subject', { name })),
        text: [
            `${t('greeting')}\n${t('intro', { name })}`,
            [t('factsHeading'), ...facts].join('\n'),
            t('review'),
            t('correction'),
            t('signature'),
        ].join('\n\n'),
    };
}
