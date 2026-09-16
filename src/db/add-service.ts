/**
 * Dodaje jeden wpis katalogowy z pliku JSON do zywej bazy.
 *
 * Zastepuje jednorazowe skrypty w stylu `add-ifiora.ts`: opis wpisu jest danymi
 * (`data/services/<slug>.json`), a nie kodem, wiec nie trzeba pisac nowego
 * skryptu na kazda firme i nie trzeba przechodzic przez `db:reset`, ktory
 * skasowalby wszystko.
 *
 * Uruchomienie:
 *   npm run db:add -- data/services/ifiora.json --dry-run   # sama walidacja
 *   npm run db:add -- data/services/ifiora.json             # zapis
 *
 * Po zapisie: `npm run db:embeddings` — dorobi embeddingi nowym lokalizacjom.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { and, eq, inArray } from 'drizzle-orm';

import { db } from './index';
import {
    buildLocationSlugs,
    serviceInputSchema,
    type ServiceInput,
    type TagInput,
} from './service-input-schema';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTable,
    tagsTranslationsTable,
} from './schema';

const LANGUAGES = ['pl', 'uk', 'en', 'ru'] as const;

type Database = typeof db;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Client = Database | Transaction;

type Options = {
    filePath: string;
    isDryRun: boolean;
};

/* eslint-disable no-console */

function fail(message: string): never {
    console.error(`BLAD: ${message}`);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
}

function parseOptions(argv: string[]): Options {
    const isDryRun = argv.includes('--dry-run');
    const filePath = argv.find(argument => !argument.startsWith('--'));

    if (!filePath) {
        fail('podaj sciezke do pliku JSON, np. npm run db:add -- data/services/ifiora.json');
    }

    if (!existsSync(filePath)) fail(`plik ${filePath} nie istnieje`);

    return { filePath, isDryRun };
}

async function readInput(filePath: string): Promise<ServiceInput> {
    const raw = await readFile(filePath, 'utf8');

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        fail(`${filePath} nie jest poprawnym JSON-em: ${(error as Error).message}`);
    }

    const result = serviceInputSchema.safeParse(parsed);
    if (!result.success) {
        console.error(`BLAD: ${filePath} nie przeszedl walidacji:`);
        for (const issue of result.error.issues) {
            console.error(`  ${issue.path.join('.') || '(korzen)'}: ${issue.message}`);
        }
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
    }

    return result.data;
}

/**
 * `service-card.tsx` podstawia `/default.png` TYLKO gdy kolumna `image` jest
 * NULL. Nazwa pliku wpisana "na zapas", bez pliku w `public/services/`, dalaby
 * wiec 404 zamiast grafiki zastepczej.
 */
function resolveImage(image: string | null | undefined): string | null {
    if (!image) return null;

    if (!existsSync(path.join(process.cwd(), 'public', 'services', image))) {
        console.warn(
            `UWAGA: brak public/services/${image} — zapisuje image=NULL, karta uzyje /default.png.`,
        );
        return null;
    }

    return image;
}

/** Zwraca id tagu o danej polskiej nazwie albo `null`, jesli taki tag nie istnieje. */
async function findTagId(client: Client, namePl: string): Promise<string | null> {
    const [existing] = await client
        .select({ tagId: tagsTranslationsTable.tagId })
        .from(tagsTranslationsTable)
        .where(
            and(
                eq(tagsTranslationsTable.languageCode, 'pl'),
                eq(tagsTranslationsTable.name, namePl),
            ),
        )
        .limit(1);

    return existing?.tagId ?? null;
}

async function ensureTag(client: Transaction, tag: TagInput): Promise<string> {
    const existingId = await findTagId(client, tag.pl);
    if (existingId) return existingId;

    const [created] = await client.insert(tagsTable).values({}).returning({ id: tagsTable.id });
    await client.insert(tagsTranslationsTable).values(
        LANGUAGES.map(language => ({
            tagId: created.id,
            languageCode: language,
            name: tag[language],
        })),
    );

    return created.id;
}

/** Slug lokalizacji jest UNIQUE — kolizja to albo duplikat wpisu, albo zla nazwa. */
async function findTakenSlugs(slugs: string[]): Promise<string[]> {
    const rows = await db
        .select({ slug: serviceLocationsTable.slug })
        .from(serviceLocationsTable)
        .where(inArray(serviceLocationsTable.slug, slugs));

    return rows.map(row => row.slug);
}

async function findServicesWithSameName(name: string): Promise<number> {
    const rows = await db
        .select({ id: servicesTable.id })
        .from(servicesTable)
        .where(eq(servicesTable.name, name));

    return rows.length;
}

async function reportPlan(input: ServiceInput, slugs: string[], image: string | null) {
    console.log(`Wpis:      ${input.name}`);
    console.log(`Kategoria: ${input.category} | zasieg: ${input.coverage} | status: ${input.status}`);
    console.log(`Jezyki:    ${input.languages.join(', ')} | verified: ${input.verified}`);
    console.log(`Obrazek:   ${image ?? 'NULL (karta uzyje /default.png)'}`);
    console.log(`Lokalizacje (${input.locations.length}):`);
    for (const [index, location] of input.locations.entries()) {
        const pin =
            location.latitude === null || location.latitude === undefined
                ? 'bez pinu'
                : `${location.latitude}, ${location.longitude}`;
        const main = location.isMainLocation ? ' [glowna]' : '';
        console.log(`  - ${slugs[index]} — ${location.city} (${pin})${main}`);
    }

    if (input.tags.length === 0) {
        console.log('Tagi:      brak');
        return;
    }

    console.log('Tagi:');
    for (const tag of input.tags) {
        const existingId = await findTagId(db, tag.pl);
        console.log(`  - ${tag.pl} ${existingId ? '(istnieje, uzyje ponownie)' : '(NOWY)'}`);
    }
}

async function insertService(input: ServiceInput, slugs: string[], image: string | null) {
    return db.transaction(async tx => {
        const [service] = await tx
            .insert(servicesTable)
            .values({
                name: input.name,
                category: input.category,
                coverage: input.coverage,
                status: input.status,
                verified: input.verified,
                image,
                languages: input.languages,
            })
            .returning({ id: servicesTable.id });

        await tx.insert(servicesTranslationsTable).values(
            LANGUAGES.map(language => ({
                serviceId: service.id,
                languageCode: language,
                name: input.translations[language].name ?? input.name,
                description: input.translations[language].description,
            })),
        );

        await tx.insert(serviceLocationsTable).values(
            input.locations.map((location, index) => ({
                serviceId: service.id,
                slug: slugs[index],
                city: location.city,
                street: location.street ?? null,
                voivodeship: location.voivodeship ?? null,
                postcode: location.postcode ?? null,
                latitude: location.latitude ?? null,
                longitude: location.longitude ?? null,
                openingHours: location.openingHours,
                phoneNumber: location.phoneNumber ?? null,
                email: location.email ?? null,
                webpage: location.webpage ?? null,
                nip: location.nip ?? null,
                socials: location.socials ?? null,
                whatsappNumber: location.whatsappNumber ?? null,
                isMainLocation: location.isMainLocation,
            })),
        );

        const tagIds: string[] = [];
        for (const tag of input.tags) {
            tagIds.push(await ensureTag(tx, tag));
        }

        if (tagIds.length > 0) {
            await tx
                .insert(servicesTagsTable)
                .values(tagIds.map(tagId => ({ serviceId: service.id, tagId })));
        }

        return service.id;
    });
}

async function main(): Promise<void> {
    const { filePath, isDryRun } = parseOptions(process.argv.slice(2));
    const input = await readInput(filePath);
    const slugs = buildLocationSlugs(
        input.slug,
        input.locations.map(location => location.city),
    );

    const taken = await findTakenSlugs(slugs);
    if (taken.length > 0) {
        fail(`slug juz istnieje w bazie: ${taken.join(', ')} — to duplikat wpisu`);
    }

    const sameName = await findServicesWithSameName(input.name);
    if (sameName > 0) {
        console.warn(
            `UWAGA: w bazie jest juz ${sameName} wpis(ow) o nazwie "${input.name}" pod innym slugiem.`,
        );
    }

    const image = resolveImage(input.image);
    await reportPlan(input, slugs, image);

    if (isDryRun) {
        console.log('\n--dry-run: nic nie zapisano.');
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }

    const serviceId = await insertService(input, slugs, image);

    console.log(`\nDodano "${input.name}" (service id ${serviceId}).`);
    console.log('Nastepny krok: npm run db:embeddings');
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('Blad:', error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
});
