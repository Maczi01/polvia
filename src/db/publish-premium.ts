/**
 * Publikuje tresc premium (blok `premium` z pliku wpisu) w `service_profiles`.
 *
 * Uruchomienie:
 *   npm run db:premium -- data/services/<plik>.json --dry-run   # walidacja + diff, bez zapisu
 *   npm run db:premium -- data/services/<plik>.json             # zapis (upsert)
 *   npm run db:premium -- data/services/<plik>.json --force     # zapis mimo podejrzanej daty
 *
 * Premium reczne (przelew): `premium.activeUntil` = ostatni dzien premium (RRRR-MM-DD, wlacznie,
 * Europe/Warsaw). Zapis ustawia `service_profiles.manual_premium_until` i podbija ranking
 * (`promoted_services`, bez skracania dluzszej daty); diff pokazuje zmiane daty. Przedluzenie
 * = nowa data w JSON-ie + ta sama komenda. Data z przeszlosci albo dalej niz 2 lata naprzod
 * (literowka roku) daje ostrzezenie w diffie, a zapis bez `--force` jest wstrzymany.
 *
 * Wpis musi juz byc w bazie (`db:add`). Zdjecia musza lezec w `public/services/<slug-uslugi>/`
 * — brak ktoregokolwiek przerywa przed zapisem. Upsert jest idempotentny, wiec ponowne
 * uruchomienie po poprawkach w JSON jest bezpieczne. Concierge: `.claude/skills/dodaj/SKILL.md`.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { formatZodIssue } from './format-zod-issue';
import { db } from './index';
import { describePremiumChanges } from './premium-content-diff';
import type { PremiumContentData } from './premium-content-schema';
import { createPremiumContentStore } from './premium-content-store';
import { serviceInputSchema } from './service-input-schema';
import {
    activeUntilWarning,
    PremiumContentError,
    preparePremiumUpsert,
    resolveEntryService,
} from './upsert-premium-content';

/* eslint-disable no-console, unicorn/no-process-exit */

type Options = { filePath: string; isDryRun: boolean; isForced: boolean };

function fail(message: string): never {
    console.error(`BLAD: ${message}`);
    process.exit(1);
}

function parseOptions(argv: string[]): Options {
    const isDryRun = argv.includes('--dry-run');
    const isForced = argv.includes('--force');
    const filePath = argv.find(argument => !argument.startsWith('--'));

    if (!filePath) fail('podaj plik wpisu, np. npm run db:premium -- data/services/ifiora.json');
    if (!existsSync(filePath)) fail(`plik ${filePath} nie istnieje`);

    return { filePath, isDryRun, isForced };
}

async function readEntry(filePath: string) {
    let parsed: unknown;
    try {
        parsed = JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
        fail(
            `${filePath} nie jest poprawnym JSON-em: ${error instanceof Error ? error.message : ''}`,
        );
    }

    const result = serviceInputSchema.safeParse(parsed);
    if (!result.success) {
        console.error(`BLAD: ${filePath} nie przeszedl walidacji:`);
        for (const issue of result.error.issues) {
            console.error(`  ${formatZodIssue(issue)}`);
        }
        process.exit(1);
    }

    const { premium } = result.data;
    if (!premium) fail(`${filePath} nie ma bloku "premium"`);

    return { entry: result.data, premium };
}

/** Podejrzana data premium recznego: ostrzezenie zawsze, zapis tylko z `--force`. */
function warnAboutActiveUntil(
    premium: PremiumContentData,
    { isDryRun, isForced }: Omit<Options, 'filePath'>,
): void {
    const warning = activeUntilWarning(premium, new Date());
    if (warning === null) return;

    console.warn(`\nUWAGA: ${warning}`);
    if (isDryRun) {
        console.warn('Zapis bez --force zostanie wstrzymany.');
        return;
    }
    if (!isForced) fail('zapis wstrzymany — popraw date w pliku albo potwierdz ja flaga --force');
}

async function main(): Promise<void> {
    const { filePath, isDryRun, isForced } = parseOptions(process.argv.slice(2));
    const { entry, premium } = await readEntry(filePath);
    const store = createPremiumContentStore(db);

    const service = await resolveEntryService(store, entry);
    const { serviceSlug } = service;
    // Celowo `preparePremiumUpsert` + `saveContent`, a nie `upsertPremiumContent` (prepare +
    // save w jednym): miedzy krokami jest wydruk diffu i wyjscie przy `--dry-run`. Hook
    // w `upsertPremiumContent` decydujacy o zapisie zastapilby dwie czytelne linie flaga
    // sterujaca, ktorej seed (`publishPremiumEntries`) nie potrzebuje.
    const plan = await preparePremiumUpsert(store, {
        service,
        content: premium,
        publicDir: path.join(process.cwd(), 'public'),
    });

    console.log(`Wpis:   ${entry.name}`);
    console.log(`Profil: /firma/${serviceSlug} (service id ${plan.serviceId})`);
    for (const line of describePremiumChanges(plan.previous, premium)) console.log(line);

    warnAboutActiveUntil(premium, { isDryRun, isForced });

    if (isDryRun) {
        console.log('\n--dry-run: nic nie zapisano.');
        process.exit(0);
    }

    await store.saveContent(plan.serviceId, premium);
    console.log(`\nOpublikowano tresc premium dla /firma/${serviceSlug}.`);
    console.log(
        premium.activeUntil === undefined
            ? 'Bez premium recznego: strona pokaze tresc tylko przy aktywnej subskrypcji Stripe.'
            : `Premium reczne aktywne do ${premium.activeUntil} wlacznie (Europe/Warsaw), ` +
                  'ranking podbity do tej daty.',
    );
    process.exit(0);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    if (error instanceof PremiumContentError) fail(error.message);
    console.error('Blad:', error);
    process.exit(1);
});
