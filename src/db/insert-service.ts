import { and, eq, inArray, like, or } from 'drizzle-orm';

import { db } from './index';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTable,
    tagsTranslationsTable,
} from './schema';
import { buildLocationSlugs, type ServiceInput, type TagInput } from './service-input-schema';
import { planNewServiceSlug, serviceSlugBase } from './service-slugs';

/**
 * Zapis jednego wpisu katalogowego do bazy. Wspolny dla `db:add` i publikacji z panelu,
 * dlatego bez `server-only` i aliasu `@/`: modul uruchamia tez skrypt CLI.
 */

const LANGUAGES = ['pl', 'uk', 'en', 'ru'] as const;

type Database = typeof db;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Client = Database | Transaction;

export type SlugPlan = {
    /** Adres `/firma/<serviceSlug>` — zawsze z nazwy. */
    serviceSlug: string;
    /** Slugi lokalizacji z bazy `input.slug`, w kolejnosci `input.locations`. */
    locationSlugs: string[];
};

export type SlugPlanResult = { ok: true; slugs: SlugPlan } | { ok: false; message: string };

/** Zwraca id tagu o danej polskiej nazwie albo `null`, jesli taki tag nie istnieje. */
export async function findTagId(client: Client, namePl: string): Promise<string | null> {
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

/**
 * Zajete slugi uslug, z ktorymi moze skolidowac slug z nazwy: `<baza>` i `<baza>-*`.
 * Baza ma format `[a-z0-9-]` (`buildServiceSlug`), wiec nie zawiera znakow
 * specjalnych `LIKE` (`%`, `_`); wartosc i tak idzie jako parametr.
 */
async function findTakenServiceSlugs(base: string): Promise<string[]> {
    const rows = await db
        .select({ slug: servicesTable.slug })
        .from(servicesTable)
        .where(or(eq(servicesTable.slug, base), like(servicesTable.slug, `${base}-%`)));

    return rows.flatMap(({ slug }) => (slug === null ? [] : [slug]));
}

/** Slug lokalizacji jest UNIQUE — kolizja to albo duplikat wpisu, albo zla nazwa. */
async function findTakenLocationSlugs(slugs: string[]): Promise<string[]> {
    const rows = await db
        .select({ slug: serviceLocationsTable.slug })
        .from(serviceLocationsTable)
        .where(inArray(serviceLocationsTable.slug, slugs));

    return rows.map(row => row.slug);
}

export async function findServicesWithSameName(name: string): Promise<number> {
    const rows = await db
        .select({ id: servicesTable.id })
        .from(servicesTable)
        .where(eq(servicesTable.name, name));

    return rows.length;
}

export async function planServiceSlugs(input: ServiceInput): Promise<SlugPlanResult> {
    const locationSlugs = buildLocationSlugs(
        input.slug,
        input.locations.map(location => location.city),
    );

    const [takenServiceSlugs, takenLocationSlugs] = await Promise.all([
        findTakenServiceSlugs(serviceSlugBase(input.name)),
        findTakenLocationSlugs(locationSlugs),
    ]);
    const plan = planNewServiceSlug({ name: input.name, takenServiceSlugs, takenLocationSlugs });
    if (!plan.ok) return { ok: false, message: plan.message };

    return { ok: true, slugs: { serviceSlug: plan.serviceSlug, locationSlugs } };
}

/**
 * Wstawia wpis w jednej transakcji. `afterInsert` dziala w tej samej transakcji, wiec jego
 * blad cofa tez wpis. Zwraca id uslugi.
 */
export async function insertService(
    input: ServiceInput,
    slugs: SlugPlan,
    image: string | null,
    afterInsert?: (tx: Transaction) => Promise<void>,
): Promise<string> {
    return db.transaction(async tx => {
        const [service] = await tx
            .insert(servicesTable)
            .values({
                name: input.name,
                slug: slugs.serviceSlug,
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
                slug: slugs.locationSlugs[index],
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

        await afterInsert?.(tx);

        return service.id;
    });
}
