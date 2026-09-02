/**
 * Jednorazowy skrypt: dodaje wpis "IT Deweloper" (Bialystok, zasieg online)
 * oraz brakujace tagi IT do zywej bazy.
 *
 * Odpowiednik tego wpisu jest juz w `seed.ts` — ten skrypt istnieje tylko po to,
 * zeby wstawic go do dzialajacej bazy BEZ przechodzenia przez `db:reset`, ktory
 * skasowalby wszystko. Po uruchomieniu plik mozna usunac.
 *
 * Wymaga wartosci 'it' w enumie `category` — najpierw `npm run drizzle:push`.
 *
 * Uruchomienie:
 *   node --require dotenv/config --import tsx src/db/add-it-deweloper.ts
 */

import { and, eq, sql } from 'drizzle-orm';
import slugify from 'slugify';

import { db } from '../db';
import {
    serviceLocationsTable,
    servicesTable,
    servicesTagsTable,
    servicesTranslationsTable,
    tagsTable,
    tagsTranslationsTable,
} from '../db/schema';

type TagSeed = {
    pl: string;
    uk: string;
    en: string;
    ru: string;
};

const TAGS: TagSeed[] = [
    { pl: 'Tworzenie stron', uk: 'Створення сайтів', en: 'Web Development', ru: 'Создание сайтов' },
    { pl: 'SEO', uk: 'SEO', en: 'SEO', ru: 'SEO' },
    {
        pl: 'Sklepy internetowe',
        uk: 'Інтернет-магазини',
        en: 'Online Stores',
        ru: 'Интернет-магазины',
    },
    { pl: 'Rozwiązania AI', uk: 'AI-рішення', en: 'AI Solutions', ru: 'AI-решения' },
    { pl: 'Hosting', uk: 'Хостинг', en: 'Hosting', ru: 'Хостинг' },
];

const SERVICE = {
    name: 'IT Deweloper',
    slug: 'it-deweloper',
    city: 'Białystok',
    descriptions: {
        pl: 'Web studio pełnego cyklu z Białegostoku. Tworzenie stron internetowych, sklepów online, portali korporacyjnych i serwisów informacyjnych dla klientów w Polsce, Europie i na świecie. SEO, integracje z księgowością i ekosystemem Google, hosting, bezpieczeństwo i rozwiązania AI.',
        uk: 'Веб-студія повного циклу з Білостока. Розробка сайтів, інтернет-магазинів, корпоративних порталів і новинних проєктів для клієнтів у Польщі, Європі та світі. SEO, інтеграції з бухгалтерією та екосистемою Google, хостинг, безпека та AI-рішення.',
        en: 'Full-cycle web studio based in Białystok. Websites, online stores, corporate portals and news projects for clients in Poland, Europe and worldwide. SEO, accounting and Google ecosystem integrations, hosting, security and AI solutions.',
        ru: 'Веб-студия полного цикла из Белостока. Разработка сайтов, интернет-магазинов, корпоративных порталов и новостных проектов для клиентов в Польше, Европе и мире. SEO, интеграции с бухгалтерией и экосистемой Google, хостинг, безопасность и AI-решения.',
    },
} as const;

/** Wartosc enuma musi istniec w bazie, zanim wstawimy wiersz, ktory jej uzywa. */
async function assertCategoryEnumHasIt(): Promise<void> {
    const rows = await db.execute<{ enumlabel: string }>(
        sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'category' AND e.enumlabel = 'it'`,
    );

    if (rows.length === 0) {
        throw new Error(
            "Enum `category` nie zna wartosci 'it'. Uruchom najpierw `npm run drizzle:push`.",
        );
    }
}

/** Zwraca id tagu o danej polskiej nazwie — istniejacego albo swiezo utworzonego. */
async function ensureTag(tag: TagSeed): Promise<string> {
    const [existing] = await db
        .select({ tagId: tagsTranslationsTable.tagId })
        .from(tagsTranslationsTable)
        .where(
            and(
                eq(tagsTranslationsTable.languageCode, 'pl'),
                eq(tagsTranslationsTable.name, tag.pl),
            ),
        )
        .limit(1);

    if (existing) {
        console.log(`  tag "${tag.pl}" juz istnieje — uzywam go ponownie`);
        return existing.tagId;
    }

    const [created] = await db.insert(tagsTable).values({}).returning({ id: tagsTable.id });
    await db.insert(tagsTranslationsTable).values([
        { tagId: created.id, languageCode: 'pl', name: tag.pl },
        { tagId: created.id, languageCode: 'uk', name: tag.uk },
        { tagId: created.id, languageCode: 'en', name: tag.en },
        { tagId: created.id, languageCode: 'ru', name: tag.ru },
    ]);
    console.log(`  tag "${tag.pl}" utworzony`);
    return created.id;
}

async function main(): Promise<void> {
    await assertCategoryEnumHasIt();

    const locationSlug = `${SERVICE.slug}-${slugify(SERVICE.city, { lower: true, strict: true })}`;

    const [alreadyThere] = await db
        .select({ id: serviceLocationsTable.id })
        .from(serviceLocationsTable)
        .where(eq(serviceLocationsTable.slug, locationSlug))
        .limit(1);

    if (alreadyThere) {
        console.log(`Wpis "${locationSlug}" juz jest w bazie — nic nie robie.`);
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(0);
    }

    console.log('Tagi:');
    const tagIds: string[] = [];
    for (const tag of TAGS) {
        tagIds.push(await ensureTag(tag));
    }

    const [service] = await db
        .insert(servicesTable)
        .values({
            name: SERVICE.name,
            category: 'it',
            coverage: 'online',
            status: 'active',
            languages: ['pl', 'uk', 'en', 'ru', 'be'],
        })
        .returning({ id: servicesTable.id });

    await db.insert(servicesTranslationsTable).values(
        (['pl', 'uk', 'en', 'ru'] as const).map(language => ({
            serviceId: service.id,
            languageCode: language,
            name: SERVICE.name,
            description: SERVICE.descriptions[language],
        })),
    );

    // Zasieg `online` => brak wspolrzednych, wiec brak pinu na mapie. Adres
    // zapisujemy, bo jest prawdziwy i buduje zaufanie na karcie wpisu.
    await db.insert(serviceLocationsTable).values({
        serviceId: service.id,
        slug: locationSlug,
        city: SERVICE.city,
        street: 'Nowogródzka 4A',
        voivodeship: 'podlaskie',
        postcode: '15-490',
        latitude: null,
        longitude: null,
        openingHours: {},
        phoneNumber: '+48 731 190 041',
        email: 'office@it-deweloper.pl',
        webpage: 'https://it-deweloper.pl/',
        socials: {
            facebook: 'https://www.facebook.com/ITdeweloper',
            linkedin: 'https://www.linkedin.com/company/it-deweloper',
            telegram: 'https://t.me/+48731190041',
            whatsapp: 'https://wa.me/48731190041',
        },
        whatsappNumber: '+48 731 190 041',
        isMainLocation: true,
    });

    await db
        .insert(servicesTagsTable)
        .values(tagIds.map(tagId => ({ serviceId: service.id, tagId })));

    console.log(`Dodano "${SERVICE.name}" (${locationSlug}), service id ${service.id}.`);
    console.log('Nastepny krok: `npm run db:embeddings` — dorobi embedding dla nowej lokalizacji.');
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error: unknown) => {
    console.error('Blad:', error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
});
