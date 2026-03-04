import slugify from 'slugify';
import { db } from '../db';
import {
    servicesTable,
    serviceLocationsTable,
    servicesTranslationsTable,
    tagsTable,
    tagsTranslationsTable,
    servicesTagsTable
} from '../db/schema';

async function exampleSeed() {
    console.log('🚀 Starting example seed (5 services)...');

    // --- HELPER: HOURS ---
    const standardGastroHours = {
        monday: { open: "08:00", close: "21:00" },
        tuesday: { open: "08:00", close: "21:00" },
        wednesday: { open: "08:00", close: "21:00" },
        thursday: { open: "08:00", close: "21:00" },
        friday: { open: "08:00", close: "22:00" },
        saturday: { open: "09:00", close: "22:00" },
        sunday: { open: "09:00", close: "21:00" }
    };

    const standardShopHours = {
        monday: { open: "09:00", close: "21:00" },
        tuesday: { open: "09:00", close: "21:00" },
        wednesday: { open: "09:00", close: "21:00" },
        thursday: { open: "09:00", close: "21:00" },
        friday: { open: "09:00", close: "21:00" },
        saturday: { open: "09:00", close: "21:00" },
        sunday: { open: "10:00", close: "18:00" }
    };

    // --- 1. PREPARE TAGS ---
    const tagMap: Record<string, string> = {};

    const tagsToCreate = [
        { key: 'bakery', pl: 'Piekarnia', uk: 'Пекарня', en: 'Bakery', ru: 'Пекарня' },
        { key: 'coffee', pl: 'Kawa', uk: 'Кава', en: 'Coffee', ru: 'Кофе' },
        { key: 'grocery', pl: 'Spożywczy', uk: 'Продукти', en: 'Grocery', ru: 'Продукты' },
        { key: 'imported', pl: 'Importowane', uk: 'Імпорт', en: 'Imported', ru: 'Импорт' },
        { key: 'beauty', pl: 'Uroda', uk: 'Краса', en: 'Beauty', ru: 'Красота' },
        { key: 'nails', pl: 'Paznokcie', uk: 'Манікюр', en: 'Nails', ru: 'Маникюр' },
        { key: 'haircare', pl: 'Włosy', uk: 'Волосся', en: 'Hair Care', ru: 'Волосы' },
        { key: 'delivery', pl: 'Dostawa', uk: 'Доставка', en: 'Delivery', ru: 'Доставка' },
        { key: 'logistics', pl: 'Logistyka', uk: 'Логістика', en: 'Logistics', ru: 'Логистика' },
        { key: 'car-service', pl: 'Serwis samochodowy', uk: 'Автосервіс', en: 'Car Service', ru: 'Автосервис' },
        { key: 'diagnostics', pl: 'Diagnostyka', uk: 'Діагностика', en: 'Diagnostics', ru: 'Диагностика' },
        { key: 'home', pl: 'Domowe', uk: 'Домашнє', en: 'Homemade', ru: 'Домашнее' },
        { key: 'dumplings', pl: 'Pierogi', uk: 'Вареники', en: 'Dumplings', ru: 'Вареники' },
        { key: 'poland-ukraine', pl: 'Polska-Ukraina', uk: 'Польща-Україна', en: 'Poland-Ukraine', ru: 'Польша-Украина' },
    ];

    for (const t of tagsToCreate) {
        const [tag] = await db.insert(tagsTable).values({}).returning();
        await db.insert(tagsTranslationsTable).values([
            { tagId: tag.id, languageCode: 'pl', name: t.pl },
            { tagId: tag.id, languageCode: 'uk', name: t.uk },
            { tagId: tag.id, languageCode: 'en', name: t.en },
            { tagId: tag.id, languageCode: 'ru', name: t.ru },
        ]);
        tagMap[t.key] = tag.id;
    }

    // --- HELPER: SEEDER FUNCTION ---
    async function seedService(data: {
        name: string, slug: string, category: any, webpage?: string,
        image?: string,
        plDesc: string, ukDesc: string, enDesc: string, ruDesc: string,
        locations: any[],
        tags: string[],
        languages?: string[],
        socials?: any,
        nip?: string,
        whatsappNumber?: string,
    }) {
        const [service] = await db.insert(servicesTable).values({
            name: data.name,
            category: data.category,
            image: data.image,
            languages: data.languages || ['pl', 'uk', 'en', 'ru'],
            status: 'active'
        }).returning();

        await db.insert(servicesTranslationsTable).values([
            { serviceId: service.id, languageCode: 'pl', name: data.name, description: data.plDesc },
            { serviceId: service.id, languageCode: 'uk', name: data.name, description: data.ukDesc },
            { serviceId: service.id, languageCode: 'en', name: data.name, description: data.enDesc },
            { serviceId: service.id, languageCode: 'ru', name: data.name, description: data.ruDesc },
        ]);

        const cityCount: Record<string, number> = {};
        for (const loc of data.locations) {
            const citySlug = slugify(loc.city || 'unknown', { lower: true, strict: true });
            cityCount[citySlug] = (cityCount[citySlug] || 0) + 1;
        }
        const cityIndex: Record<string, number> = {};

        await db.insert(serviceLocationsTable).values(
            data.locations.map(loc => {
                const citySlug = slugify(loc.city || 'unknown', { lower: true, strict: true });
                cityIndex[citySlug] = (cityIndex[citySlug] || 0) + 1;
                const needsIndex = cityCount[citySlug] > 1;
                const slug = needsIndex
                    ? `${data.slug}-${citySlug}-${cityIndex[citySlug]}`
                    : `${data.slug}-${citySlug}`;
                return {
                    ...loc,
                    serviceId: service.id,
                    slug,
                    webpage: loc.webpage ?? data.webpage,
                    nip: loc.nip ?? data.nip,
                    socials: loc.socials ?? data.socials,
                    whatsappNumber: loc.whatsappNumber ?? data.whatsappNumber,
                };
            })
        );

        if (data.tags.length > 0) {
            await db.insert(servicesTagsTable).values(
                data.tags.map(tKey => ({ serviceId: service.id, tagId: tagMap[tKey] }))
            );
        }
        console.log(`Added ${data.name} (${data.slug}) with ${data.locations.length} locations.`);
    }

    // --- SERVICES ---

    // 1. GASTRONOMY — Lviv Croissants
    await seedService({
        name: 'Lviv Croissants',
        slug: 'lviv-croissants',
        category: 'gastronomy',
        plDesc: 'Legendarna ukraińska sieć piekarni. Croissanty wypiekane na miejscu.',
        ukDesc: 'Легендарна українська мережа пекарень. Свіжоспечені круасани.',
        enDesc: 'Legendary Ukrainian bakery chain. Freshly baked croissants on site.',
        ruDesc: 'Легендарная украинская сеть пекарен. Круассаны, выпеченные на месте.',
        tags: ['bakery', 'coffee'],
        image: 'lviv-croissants.png',
        webpage: 'https://lvivcroissants.com/',
        locations: [
            { city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.2331, longitude: 21.0175, openingHours: standardGastroHours, isMainLocation: true },
            { city: 'Kraków', street: 'Grodzka 50', voivodeship: 'malopolskie', latitude: 50.057, longitude: 19.9385, openingHours: standardGastroHours },
        ],
    });

    // 2. GROCERY — Best Market
    await seedService({
        name: 'Best Market',
        slug: 'best-market',
        category: 'grocery',
        plDesc: 'Największa w Polsce sieć sklepów z autentycznymi produktami z Ukrainy, Gruzji, Mołdawii i innych krajów wschodnich.',
        ukDesc: 'Найбільша в Польщі мережа магазинів з автентичними продуктами з України, Грузії, Молдови та інших східних країн.',
        enDesc: 'The largest chain of stores in Poland with authentic products from Ukraine, Georgia, Moldova and other Eastern countries.',
        ruDesc: 'Крупнейшая в Польше сеть магазинов с аутентичными продуктами из Украины, Грузии, Молдовы и других восточных стран.',
        tags: ['grocery', 'imported'],
        image: 'best-market.png',
        webpage: 'https://best-market.pl/lokalizacje/',
        socials: { facebook: 'https://www.facebook.com/bestmarketpl/', instagram: 'https://www.instagram.com/bestmarket_pl/' },
        locations: [
            { city: 'Warszawa', street: 'al. Jana Pawła II 52/54', voivodeship: 'mazowieckie', latitude: 52.2425, longitude: 20.9936, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 797 509 986', email: 'kontakt@best-market.pl' },
            { city: 'Kraków', street: 'ul. Solna 1', voivodeship: 'malopolskie', latitude: 50.0475, longitude: 19.9585, openingHours: standardShopHours },
        ],
    });

    // 3. BEAUTY — G.Bar
    await seedService({
        name: 'G.Bar',
        slug: 'g-bar-beauty',
        category: 'beauty',
        plDesc: 'Największa na świecie sieć barów beauty pochodząca z Ukrainy. Kompleksowe usługi: od manicure po profesjonalne makijaże i stylizacje włosów.',
        ukDesc: 'Найбільша у світі мережа бʼюті-барів родом з України. Комплексні послуги: від манікюру до професійного макіяжу та укладок.',
        enDesc: 'The world\'s largest beauty bar chain from Ukraine. Comprehensive services: from manicure to professional makeup and hair styling.',
        ruDesc: 'Крупнейшая в мире сеть бьюти-баров родом из Украины. Комплексные услуги: от маникюра до профессионального макияжа и укладок.',
        tags: ['beauty', 'nails', 'haircare'],
        webpage: 'https://gbar.pl/pl',
        image: 'gbar.png',
        locations: [
            { city: 'Warszawa', street: 'ul. Przyokopowa 26', voivodeship: 'mazowieckie', latitude: 52.2302, longitude: 20.9811, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 4. TRANSPORT — example
    await seedService({
        name: 'TransUA Express',
        slug: 'transua-express',
        category: 'transport',
        plDesc: 'Szybki i niezawodny transport paczek i ładunków na trasie Polska–Ukraina.',
        ukDesc: 'Швидке та надійне перевезення посилок і вантажів на маршруті Польща–Україна.',
        enDesc: 'Fast and reliable parcel and cargo transport on the Poland–Ukraine route.',
        ruDesc: 'Быстрая и надёжная перевозка посылок и грузов на маршруте Польша–Украина.',
        tags: ['delivery', 'logistics', 'poland-ukraine'],
        image: 'transua-express.png',
        webpage: 'https://example.com/transua',
        locations: [
            { city: 'Warszawa', street: 'ul. Marszałkowska 100', voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 500 000 000' },
        ],
    });

    // 5. MECHANICS — example
    await seedService({
        name: 'AutoMajster UA',
        slug: 'automajster-ua',
        category: 'mechanics',
        plDesc: 'Profesjonalny serwis samochodowy prowadzony przez ukraińskich specjalistów. Diagnostyka, naprawa silników i wymiana oleju.',
        ukDesc: 'Професійний автосервіс від українських спеціалістів. Діагностика, ремонт двигунів та заміна масла.',
        enDesc: 'Professional car service run by Ukrainian specialists. Diagnostics, engine repair and oil change.',
        ruDesc: 'Профессиональный автосервис от украинских специалистов. Диагностика, ремонт двигателей и замена масла.',
        tags: ['car-service', 'diagnostics'],
        image: 'automajster-ua.png',
        locations: [
            { city: 'Wrocław', street: 'ul. Legnicka 120', voivodeship: 'dolnoslaskie', latitude: 51.1182, longitude: 16.9925, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 600 000 000' },
        ],
    });

    console.log('✅ Example seed finished!');
}

exampleSeed()
    .catch((err) => {
        console.error('❌ Error:', err);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });
