import type { Weekday } from '@/db/service-input-schema';
import type { ServiceJson } from '@/lib/add-business/build-service-json';
import { SOCIAL_KEYS } from '@/lib/add-business/form-limits';
import {
    bulletList,
    type BuiltServiceEntry,
    formatAddress,
    formatHours,
    line,
    type Location,
    section,
    type SubmissionEmailInput,
} from '@/lib/add-business/submission-email-format';

/** Tresc maila operatora (R13): karta, flagi do sprawdzenia i instrukcja `db:add`. */

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
    socials: 'Social media (socials)',
    whatsappNumber: 'WhatsApp (whatsappNumber)',
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

function socialLines(location: Location | undefined): string[] {
    const socials = location?.socials;
    const links = SOCIAL_KEYS.flatMap(key => {
        const url = socials?.[key];
        return url ? [`${key}: ${url}`] : [];
    });
    return links.length > 0 ? ['Social media:', ...bulletList(links)] : [line('Social media', null)];
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
        line('WhatsApp (numer)', location?.whatsappNumber),
        ...socialLines(location),
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

function manualPinLines(json: ServiceJson): string[] {
    const [location] = json.locations;
    return [
        'Pinezka ustawiona ręcznie przez właściciela — sprawdź przed db:add.',
        `latitude/longitude: ${location?.latitude ?? '?'}, ${location?.longitude ?? '?'}`,
        'Województwo i kod pocztowy mogą nie pasować do tego punktu — porównaj z adresem.',
    ];
}

function warningSections({ entry, logo, manualPin }: SubmissionEmailInput): string[] {
    const warnings: string[] = [];
    if (manualPin) warnings.push(section('Pinezka ustawiona ręcznie', manualPinLines(entry.json)));
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

export function operatorText(input: SubmissionEmailInput): string {
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
