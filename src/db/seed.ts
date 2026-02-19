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

async function mainSeed() {
    console.log('🚀 Rozpoczynam wielki seed danych z Tagami (36 marek)...');

    // --- HELPER: HOURS & COORDS ---
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

    const cityCoords = {
        Warszawa: { lat: 52.2297, lon: 21.0122 },
        Kraków: { lat: 50.0647, lon: 19.9450 },
        Wrocław: { lat: 51.1079, lon: 17.0385 },
        Poznań: { lat: 52.4064, lon: 16.9252 },
        Gdańsk: { lat: 54.3520, lon: 18.6466 },
        Szczecin: { lat: 53.4285, lon: 14.5528 },
        Kielce: { lat: 50.8661, lon: 20.6286 },
        Gdynia: { lat: 54.5189, lon: 18.5305 },
        Płock: { lat: 52.5463, lon: 19.7065 },
    };

    // --- 1. PREPARE TAGS ---
    // We create a map to store tag IDs for later association
    const tagMap: Record<string, string> = {};

    const tagsToCreate = [
        { key: 'bakery', pl: 'Piekarnia', uk: 'Пекарня', en: 'Bakery', ru: 'Пекарня' },
        { key: 'coffee', pl: 'Kawa', uk: 'Кава', en: 'Coffee', ru: 'Кофе' },
        { key: 'grocery', pl: 'Spożywczy', uk: 'Продукти', en: 'Grocery', ru: 'Продукты' },
        { key: 'imported', pl: 'Importowane', uk: 'Імпорт', en: 'Imported', ru: 'Импорт' },
        { key: 'alcohol', pl: 'Alkohol', uk: 'Алкоголь', en: 'Alcohol', ru: 'Алкоголь' },
        { key: 'atmosphere', pl: 'Atmosfera', uk: 'Атмосфера', en: 'Atmosphere', ru: 'Атмосфера' },
        { key: 'beauty', pl: 'Uroda', uk: 'Краса', en: 'Beauty', ru: 'Красота' },
        { key: 'nails', pl: 'Paznokcie', uk: 'Манікюр', en: 'Nails', ru: 'Маникюр' },
        { key: 'cider', pl: 'Cydr', uk: 'Сидр', en: 'Cider', ru: 'Сидр' },
        { key: 'streetfood', pl: 'Street Food', uk: 'Вулична їжа', en: 'Street Food', ru: 'Стрит-фуд' },
        { key: 'frozen', pl: 'Mrożonki', uk: 'Заморозка', en: 'Frozen', ru: 'Заморозка' },
        { key: 'handmade', pl: 'Ręczna robota', uk: 'Ручна робота', en: 'Handmade', ru: 'Ручная работа' },
        { key: 'delivery', pl: 'Dostawa', uk: 'Доставка', en: 'Delivery', ru: 'Доставка' },
        { key: 'logistics', pl: 'Logistyka', uk: 'Логістика', en: 'Logistics', ru: 'Логистика' },
        { key: 'grill', pl: 'Grill', uk: 'Гриль', en: 'Grill', ru: 'Гриль' },
        { key: 'desserts', pl: 'Desery', uk: 'Десерти', en: 'Desserts', ru: 'Десерты' },
        { key: 'barber', pl: 'Barber', uk: 'Барбер', en: 'Barber', ru: 'Барбер' },
        { key: 'haircare', pl: 'Włosy', uk: 'Волосся', en: 'Hair Care', ru: 'Волосы' },
        { key: 'health', pl: 'Zdrowie', uk: 'Здоров\'я', en: 'Health', ru: 'Здоровье' },
        { key: 'doctor', pl: 'Lekarz', uk: 'Лікар', en: 'Doctor', ru: 'Врач' },
        { key: 'sushi', pl: 'Sushi', uk: 'Суші', en: 'Sushi', ru: 'Суши' },
        { key: 'seafood', pl: 'Owoce morza', uk: 'Морепродукти', en: 'Seafood', ru: 'Морепродукты' },
        { key: 'chocolate', pl: 'Czekolada', uk: 'Шоколад', en: 'Chocolate', ru: 'Шоколад' },
        { key: 'tradition', pl: 'Tradycja', uk: 'Традиції', en: 'Tradition', ru: 'Традиции' },
        { key: 'home', pl: 'Domowe', uk: 'Домашнє', en: 'Homemade', ru: 'Домашнее' },
        { key: 'lunch', pl: 'Lunch', uk: 'Ланч', en: 'Lunch', ru: 'Ланч' },
        { key: 'dumplings', pl: 'Pierogi', uk: 'Вареники', en: 'Dumplings', ru: 'Вареники' },
        { key: 'culture', pl: 'Kultura', uk: 'Культура', en: 'Culture', ru: 'Культура' },
        { key: 'modern', pl: 'Nowoczesne', uk: 'Сучасне', en: 'Modern', ru: 'Современное' },
        { key: 'legal', pl: 'Prawo', uk: 'Право', en: 'Legal', ru: 'Право' },
        { key: 'documents', pl: 'Dokumenty', uk: 'Документи', en: 'Documents', ru: 'Документы' },
        { key: 'mechanic', pl: 'Mechanik', uk: 'Механік', en: 'Mechanic', ru: 'Механик' },
        { key: 'repair', pl: 'Naprawa', uk: 'Ремонт', en: 'Repair', ru: 'Ремонт' },
        { key: 'cargo', pl: 'Ładunki', uk: 'Вантажі', en: 'Cargo', ru: 'Грузы' },
        { key: 'dentist', pl: 'Dentysta', uk: 'Стоматолог', en: 'Dentist', ru: 'Стоматолог' },
        { key: 'ngo', pl: 'Organizacja pozarządowa', uk: 'Громадська організація', en: 'NGO', ru: 'Общественная организация' },
        { key: 'pediatrician', pl: 'Pediatra', uk: 'Педіатр', en: 'Pediatrician', ru: 'Педиатр' },
        { key: 'polish-courses', pl: 'Kursy polskiego', uk: 'Курси польської', en: 'Polish Courses', ru: 'Курсы польского' },
        { key: 'freight', pl: 'Fracht', uk: 'Вантаж', en: 'Freight', ru: 'Груз' },
        { key: 'road-transport', pl: 'Transport drogowy', uk: 'Автоперевезення', en: 'Road Transport', ru: 'Автоперевозки' },
        { key: 'spedycja', pl: 'Spedycja', uk: 'Експедиція', en: 'Forwarding', ru: 'Экспедиция' },
        { key: 'poland-ukraine', pl: 'Polska-Ukraina', uk: 'Польща-Україна', en: 'Poland-Ukraine', ru: 'Польша-Украина' },
        { key: 'international', pl: 'Międzynarodowy', uk: 'Міжнародний', en: 'International', ru: 'Международный' },
        { key: 'ftl', pl: 'FTL', uk: 'FTL', en: 'FTL', ru: 'FTL' },
        { key: 'ltl', pl: 'LTL', uk: 'LTL', en: 'LTL', ru: 'LTL' },
        { key: 'oversize', pl: 'Ponadgabarytowy', uk: 'Негабаритний', en: 'Oversize', ru: 'Негабаритный' },
        { key: 'ukraine', pl: 'Ukraina', uk: 'Україна', en: 'Ukraine', ru: 'Украина' },
        { key: 'customs', pl: 'Odprawa celna', uk: 'Митне оформлення', en: 'Customs', ru: 'Таможенное оформление' },
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
    // To keep this readable and handle tags easily
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

        // Count locations per city for slug generation
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
    }

    // --- START SEEDING BRANDS ---

    // 1
    await seedService({
        name: 'Lviv Croissants', slug: 'lviv-croissants', category: 'gastronomy',
        plDesc: 'Legendarna ukraińska sieć piekarni. Croissanty wypiekane na miejscu.',
        ukDesc: 'Легендарна українська мережа пекарень. Свіжоспечені круасани.',
        enDesc: 'Legendary Ukrainian bakery chain. Freshly baked croissants on site.',
        ruDesc: 'Легендарная украинская сеть пекарен. Круассаны, выпеченные на месте.',
        tags: ['bakery', 'coffee'],
        image: 'lviv-croissants.png',
        webpage: 'https://lvivcroissants.com/',
        locations: [
            { city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.2331, longitude: 21.0175, openingHours: standardGastroHours, isMainLocation: true },
            { city: 'Kraków', street: 'Grodzka 50', voivodeship: 'malopolskie', latitude: 50.057, longitude: 19.9385, openingHours: standardGastroHours }
        ]
    });

    // 2
    // Best Market
    await seedService({
        name: 'Best Market',
        slug: 'best-market',
        category: 'grocery',
        plDesc: 'Największa w Polsce sieć sklepów z autentycznymi produktami z Ukrainy, Gruzji, Mołdawii i innych krajów wschodnich. Słynie z szerokiego wyboru ryb suszonych, kawioru i rzemieślniczych produktów.',
        ukDesc: 'Найбільша в Польщі мережа магазинів з автентичними продуктами з України, Грузії, Молдови та інших східних країн. Славиться широким вибором сушеної риби, ікри та крафтових виробів.',
        enDesc: 'The largest chain of stores in Poland with authentic products from Ukraine, Georgia, Moldova and other Eastern countries. Known for its wide selection of dried fish, caviar and artisan products.',
        ruDesc: 'Крупнейшая в Польше сеть магазинов с аутентичными продуктами из Украины, Грузии, Молдовы и других восточных стран. Славится широким выбором сушёной рыбы, икры и крафтовых изделий.',
        tags: ['grocery', 'imported', 'alcohol', 'seafood'],
        image: 'best-market.png',
        webpage: 'https://best-market.pl/lokalizacje/',
        socials: { facebook: 'https://www.facebook.com/bestmarketpl/', instagram: 'https://www.instagram.com/bestmarket_pl/', tiktok: 'https://www.tiktok.com/@bestmarket__pl/' },
        locations: [
            // WARSZAWA
            { city: 'Warszawa', street: 'al. Jana Pawła II 52/54', voivodeship: 'mazowieckie', latitude: 52.2425, longitude: 20.9936, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 797 509 986', email: 'kontakt@best-market.pl' },
            { city: 'Warszawa', street: 'al. KEN 52', voivodeship: 'mazowieckie', latitude: 52.1565, longitude: 21.0435, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Jana Kazimierza 53A', voivodeship: 'mazowieckie', latitude: 52.2285, longitude: 20.9415, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Jana Kowalczyka 9', voivodeship: 'mazowieckie', latitude: 52.2835, longitude: 21.0285, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Męcińska 30 paw 22/24', voivodeship: 'mazowieckie', latitude: 52.2355, longitude: 21.0825, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Stefana Okrzei 27', voivodeship: 'mazowieckie', latitude: 52.2525, longitude: 21.0455, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Zygmunta Hübnera 1', voivodeship: 'mazowieckie', latitude: 52.2195, longitude: 20.9685, openingHours: standardShopHours },

            // OKOLICE WARSZAWY
            { city: 'Piaseczno', street: 'ul. Puławska 30A', voivodeship: 'mazowieckie', latitude: 52.0725, longitude: 21.0245, openingHours: standardShopHours },
            { city: 'Pruszków', street: 'ul. Tadeusza Kościuszki 52', voivodeship: 'mazowieckie', latitude: 52.1705, longitude: 20.8015, openingHours: standardShopHours },

            // KRAKÓW
            { city: 'Kraków', street: 'ul. Solna 1', voivodeship: 'malopolskie', latitude: 50.0475, longitude: 19.9585, openingHours: standardShopHours },
            { city: 'Kraków', street: 'al. 29 Listopada 57', voivodeship: 'malopolskie', latitude: 50.0835, longitude: 19.9445, openingHours: standardShopHours },
            { city: 'Kraków', street: 'ul. Bronowicka 5', voivodeship: 'malopolskie', latitude: 50.0665, longitude: 19.9115, openingHours: standardShopHours },

            // WROCŁAW
            { city: 'Wrocław', street: 'ul. Krawiecka 3B', voivodeship: 'dolnoslaskie', latitude: 51.1085, longitude: 17.0325, openingHours: standardShopHours },
            { city: 'Wrocław', street: 'ul. Legnicka 59', voivodeship: 'dolnoslaskie', latitude: 51.1182, longitude: 16.9925, openingHours: standardShopHours },
            { city: 'Wrocław', street: 'ul. Szewska 6/7', voivodeship: 'dolnoslaskie', latitude: 51.1125, longitude: 17.0275, openingHours: standardShopHours },

            // ŁÓDŹ
            { city: 'Łódź', street: 'ul. Piotrkowska 190', voivodeship: 'lodzkie', latitude: 51.7525, longitude: 19.4565, openingHours: standardShopHours },
            { city: 'Łódź', street: 'ul. Łagiewnicka 27A', voivodeship: 'lodzkie', latitude: 51.7985, longitude: 19.4585, openingHours: standardShopHours },
            { city: 'Łódź', street: 'ul. Rydzowa 10', voivodeship: 'lodzkie', latitude: 51.7855, longitude: 19.4215, openingHours: standardShopHours },

            // POZNAŃ
            { city: 'Poznań', street: 'os. Piastowskie 17', voivodeship: 'wielkopolskie', latitude: 52.4215, longitude: 16.9565, openingHours: standardShopHours },
            { city: 'Poznań', street: 'ul. Szymańskiego 10', voivodeship: 'wielkopolskie', latitude: 52.4085, longitude: 16.9345, openingHours: standardShopHours },

            // GDAŃSK
            { city: 'Gdańsk', street: 'ul. Kołobrzeska 16A', voivodeship: 'pomorskie', latitude: 54.3965, longitude: 18.5885, openingHours: standardShopHours },
            { city: 'Gdańsk', street: 'al. Grunwaldzka 40', voivodeship: 'pomorskie', latitude: 54.3785, longitude: 18.6125, openingHours: standardShopHours },

            // ŚLĄSK
            { city: 'Katowice', street: 'ul. 3 Maja 23', voivodeship: 'slaskie', latitude: 50.2585, longitude: 19.0215, openingHours: standardShopHours },
            { city: 'Tychy', street: 'ul. Grota-Roweckiego 45', voivodeship: 'slaskie', latitude: 50.1185, longitude: 18.9855, openingHours: standardShopHours },
            { city: 'Tychy', street: 'ul. Grota-Roweckiego 47', voivodeship: 'slaskie', latitude: 50.1185, longitude: 18.9865, openingHours: standardShopHours },
            { city: 'Knurów', street: 'ul. 1 Maja 72A', voivodeship: 'slaskie', latitude: 50.2185, longitude: 18.6785, openingHours: standardShopHours },
            { city: 'Częstochowa', street: 'al. Tadeusza Kościuszki 1', voivodeship: 'slaskie', latitude: 50.8115, longitude: 19.1205, openingHours: standardShopHours },

            // POZOSTAŁE MIASTA
            { city: 'Kielce', street: 'ul. Henryka Sienkiewicza 78A', voivodeship: 'swietokrzyskie', latitude: 50.8685, longitude: 20.6385, openingHours: standardShopHours },
            { city: 'Koszalin', street: 'ul. Zwycięstwa 28', voivodeship: 'zachodniopomorskie', latitude: 54.1915, longitude: 16.1815, openingHours: standardShopHours },
            { city: 'Szczecin', street: 'al. Wyzwolenia 21', voivodeship: 'zachodniopomorskie', latitude: 53.4325, longitude: 14.5535, openingHours: standardShopHours },
            { city: 'Toruń', street: 'ul. Królowej Jadwigi 16', voivodeship: 'kujawsko-pomorskie', latitude: 53.0105, longitude: 18.6045, openingHours: standardShopHours },
            { city: 'Radom', street: 'ul. Szewska 28', voivodeship: 'mazowieckie', latitude: 51.4025, longitude: 21.1475, openingHours: standardShopHours }
        ]
    });

    // 3
    await seedService({
        name: 'Piana Vyshnia', slug: 'piana-vyshnia', category: 'gastronomy',
        plDesc: 'Słynna lwowskia nalewka wiśniowa podawana w wyjątkowej atmosferze.',
        ukDesc: 'Знаменита львівська настоянка в унікальній атмосфері.',
        enDesc: 'Famous Lviv cherry liqueur served in a unique atmosphere.',
        ruDesc: 'Знаменитая львовская вишнёвая настойка в уникальной атмосфере.',
        image: 'pijana-visnia.png',
        webpage: 'https://pianavyshnia.com/',
        socials: { instagram: 'https://www.instagram.com/pianavyshnia/', facebook: 'https://www.facebook.com/PianaVyshnia', tiktok: 'https://www.tiktok.com/@pianavyshnia' },
        tags: ['alcohol', 'atmosphere'],
        locations: [{ city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.2330, longitude: 21.0176, email: 'pianavyshnia.info@fest.foundation', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 4
    await seedService({
        name: 'G.Bar',
        slug: 'g-bar-beauty',
        category: 'beauty',
        plDesc: 'Największa na świecie sieć barów beauty pochodząca z Ukrainy. Kompleksowe usługi: od manicure po profesjonalne makijaże i stylizacje włosów w wyjątkowej atmosferze.',
        ukDesc: 'Найбільша у світі мережа бʼюті-барів родом з України. Комплексні послуги: від манікюру до професійного макіяжу та укладок у винятковій атмосфері.',
        enDesc: 'The world\'s largest beauty bar chain from Ukraine. Comprehensive services: from manicure to professional makeup and hair styling in a unique atmosphere.',
        ruDesc: 'Крупнейшая в мире сеть бьюти-баров родом из Украины. Комплексные услуги: от маникюра до профессионального макияжа и укладок в уникальной атмосфере.',
        tags: ['beauty', 'nails', 'haircare', 'atmosphere'],
        webpage: 'https://gbar.pl/pl',
        image: 'gbar.png',
        locations: [

            { city: 'Warszawa', street: 'ul. Przyokopowa 26', voivodeship: 'mazowieckie', latitude: 52.2302,  longitude: 20.9811, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Warszawa', street: 'ul. Grzybowska 4', voivodeship: 'mazowieckie', latitude: 52.2375, longitude: 21.0018, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Nowogrodzka 6A', voivodeship: 'mazowieckie', latitude: 52.23, longitude: 21.0177, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Marszałkowska 32', voivodeship: 'mazowieckie', latitude: 52.2203, longitude: 21.0178, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Franciszka Klimczaka 17', voivodeship: 'mazowieckie', latitude: 52.1597, longitude: 21.0741, openingHours: standardShopHours },
        ]
    });

    // Fast Line Studio (Szybkie usługi równoległe)
    await seedService({
        name: 'Fast Line Studio',
        slug: 'fast-line-studio',
        category: 'beauty',
        plDesc: 'Innowacyjny koncept z Ukrainy oferujący zestawy usług wykonywanych jednocześnie (np. manicure, pedicure i koloryzacja w 90 minut).',
        ukDesc: 'Інноваційна концепція з України, що пропонує сети послуг, які виконуються одночасно (наприклад, манікюр, педикюр та фарбування за 90 хвилин).',
        enDesc: 'Innovative concept from Ukraine offering service sets performed simultaneously (e.g., manicure, pedicure and coloring in 90 minutes).',
        ruDesc: 'Инновационная концепция из Украины, предлагающая наборы услуг, выполняемых одновременно (например, маникюр, педикюр и окрашивание за 90 минут).',
        tags: ['beauty', 'nails', 'haircare', 'modern'],
        image: 'fast-line-studio.png',
        webpage: 'https://fastlinestudio.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Jana Kazimierza 27', voivodeship: 'mazowieckie', latitude: 52.2215, longitude: 20.9385, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Kraków', street: 'ul. Pawia 9', voivodeship: 'malopolskie', latitude: 50.0685, longitude: 19.9455, openingHours: standardShopHours }
        ]
    });

// 6
    await seedService({
        name: 'Odessa Market',
        slug: 'odessa-market',
        category: 'grocery',
        plDesc: 'Sieć sklepów oferująca autentyczne produkty i smaki Wschodu – od Ukrainy po Gruzję i Armenię.',
        ukDesc: 'Мережа магазинів, що пропонує автентичні продукти та смаки Сходу – від України до Грузії та Вірменії.',
        enDesc: 'A chain of stores offering authentic Eastern products and flavors – from Ukraine to Georgia and Armenia.',
        ruDesc: 'Сеть магазинов, предлагающая аутентичные продукты и вкусы Востока – от Украины до Грузии и Армении.',
        tags: ['grocery', 'imported', 'frozen', 'tradition'],
        image: 'odessa-market.png',
        webpage: 'https://odessamarket.pl/',
        socials: { facebook: 'https://www.facebook.com/profile.php?id=100057526956152', instagram: 'https://www.instagram.com/odessa__market/' },
        locations: [
            {
                city: 'Warszawa',
                street: 'ul. Jana Kazimierza 29',
                voivodeship: 'mazowieckie',
                latitude: 52.2215,
                longitude: 20.9388,
                openingHours: standardShopHours,
                isMainLocation: true,
                phoneNumber: '+48 532 319 532',
                email: 'info@odessamarket.pl'
            },
            {
                city: 'Wrocław',
                street: 'ul. Nowowiejska 25/1a',
                voivodeship: 'dolnoslaskie',
                latitude: 51.1215,
                longitude: 17.0494,
                openingHours: standardShopHours
            },
            {
                city: 'Wrocław',
                street: 'ul. Żeromskiego 41/1a',
                voivodeship: 'dolnoslaskie',
                latitude: 51.1232,
                longitude: 17.0435,
                openingHours: standardShopHours
            },
            {
                city: 'Wrocław',
                street: 'ul. Legnicka 49a',
                voivodeship: 'dolnoslaskie',
                latitude: 51.1167,
                longitude: 17.0012,
                openingHours: standardShopHours
            },
            {
                city: 'Katowice',
                street: 'ul. Wrocławska 54',
                voivodeship: 'slaskie',
                latitude: 50.2678,
                longitude: 19.0345,
                openingHours: standardShopHours
            },
            {
                city: 'Gliwice',
                street: 'ul. Piwna 8',
                voivodeship: 'slaskie',
                latitude: 50.2975,
                longitude: 18.6765,
                openingHours: standardShopHours
            },
            {
                city: 'Legnica',
                street: 'ul. Pocztowa 7',
                voivodeship: 'dolnoslaskie',
                latitude: 51.2105,
                longitude: 16.1645,
                openingHours: standardShopHours
            },
            {
                city: 'Poznań',
                street: 'ul. Środka 7',
                voivodeship: 'wielkopolskie',
                latitude: 52.4111,
                longitude: 16.9535,
                openingHours: standardShopHours
            },
            {
                city: 'Lubin',
                street: 'ul. Józefa Piłsudskiego 20',
                voivodeship: 'dolnoslaskie',
                latitude: 51.3975,
                longitude: 16.2012,
                openingHours: standardShopHours
            },
            {
                city: 'Bielsko-Biała',
                street: 'ul. Babiogórska 15',
                voivodeship: 'slaskie',
                latitude: 49.8115,
                longitude: 19.0368,
                openingHours: standardShopHours
            }
        ]
    });

    // 8
    await seedService({
        name: 'Multi Cook', slug: 'multi-cook-warszawa', category: 'grocery',
        plDesc: 'Sklep z rzemieślniczymi mrożonkami.',
        ukDesc: 'Магазин заморожених напівфабрикатів ручної роботи.',
        enDesc: 'Shop with artisan frozen foods.',
        ruDesc: 'Магазин замороженных полуфабрикатов ручной работы.',
        tags: ['frozen', 'handmade'],
        image: 'multicook.png',
        webpage: 'https://multicook.com.pl/',
        socials: { facebook: 'https://www.facebook.com/multicookpolska/', instagram: 'https://www.instagram.com/multicook_polska/' },
        whatsappNumber: '+48 574 183 404',
        locations: [
            {
                city: 'Warszawa', street: 'ul. Jugosłowiańska 13', voivodeship: 'mazowieckie',
                latitude: 52.2285, longitude: 21.0965, openingHours: standardShopHours, isMainLocation: true,
                phoneNumber: '+48 574 183 404'
            },
            {
                city: 'Warszawa', street: 'ul. Modlińska 8', voivodeship: 'mazowieckie',
                latitude: 52.2885, longitude: 21.0125, openingHours: standardShopHours
            },
            {
                city: 'Warszawa', street: 'ul. Kobielska 23', voivodeship: 'mazowieckie',
                latitude: 52.2455, longitude: 21.0665, openingHours: standardShopHours
            },
        ]
    });

    // 9
    // Nova Post
    await seedService({
        name: 'Nova Post',
        slug: 'nova-post',
        category: 'transport',
        plDesc: 'Europejski oddział ukraińskiego lidera logistyki. Oferuje błyskawiczne przesyłki kurierskie, transport ładunków oraz dokumentów między Polską a Ukrainą.',
        ukDesc: 'Європейське відділення лідера української логістики. Пропонує швидку кур\'єрську доставку, перевезення вантажів та документів між Польщею та Україною.',
        enDesc: 'European branch of Ukraine\'s logistics leader. Offers fast courier delivery, cargo and document transport between Poland and Ukraine.',
        ruDesc: 'Европейское отделение лидера украинской логистики. Предлагает быструю курьерскую доставку, перевозку грузов и документов между Польшей и Украиной.',
        tags: ['logistics', 'delivery', 'documents'],
        image: 'nova-post.png',
        webpage: 'https://novapost.com/pl-pl/departments',
        locations: [
            // WARSZAWA (Główne oddziały)
            { city: 'Warszawa', street: 'ul. Męcińska 18', voivodeship: 'mazowieckie', latitude: 52.2355, longitude: 21.0825, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Warszawa', street: 'ul. Jana Pawła II 27', voivodeship: 'mazowieckie', latitude: 52.237, longitude: 20.9985, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Kaliskiego 15', voivodeship: 'mazowieckie', latitude: 52.253, longitude: 20.8985, openingHours: standardShopHours },

            // KRAKÓW
            { city: 'Kraków', street: 'ul. Kamienna 19b', voivodeship: 'malopolskie', latitude: 50.0765, longitude: 19.9415, openingHours: standardShopHours },
            { city: 'Kraków', street: 'ul. Lipska 4', voivodeship: 'malopolskie', latitude: 50.0465, longitude: 19.9885, openingHours: standardShopHours },

            // WROCŁAW
            { city: 'Wrocław', street: 'ul. Trzebnicka 50/1a', voivodeship: 'dolnoslaskie', latitude: 51.1255, longitude: 17.0355, openingHours: standardShopHours },
            { city: 'Wrocław', street: 'ul. Krakowska 124', voivodeship: 'dolnoslaskie', latitude: 51.0885, longitude: 17.0755, openingHours: standardShopHours },

            // POZNAŃ
            { city: 'Poznań', street: 'ul. Garbary 95', voivodeship: 'wielkopolskie', latitude: 52.4155, longitude: 16.9385, openingHours: standardShopHours },
            { city: 'Poznań', street: 'ul. Promienista 87', voivodeship: 'wielkopolskie', latitude: 52.3905, longitude: 16.8795, openingHours: standardShopHours },

            // GDAŃSK
            { city: 'Gdańsk', street: 'ul. Rakoczego 17', voivodeship: 'pomorskie', latitude: 54.3585, longitude: 18.5865, openingHours: standardShopHours },

            // LUBLIN (Kluczowy punkt przy granicy)
            { city: 'Lublin', street: 'ul. Kameralna 1', voivodeship: 'lubelskie', latitude: 51.2465, longitude: 22.5715, openingHours: standardShopHours },

            // RZESZÓW (Logistyczne serce przy granicy)
            { city: 'Rzeszów', street: 'ul. Kopisto 8b', voivodeship: 'podkarpackie', latitude: 50.0295, longitude: 22.0125, openingHours: standardShopHours },

            // KATOWICE
            { city: 'Katowice', street: 'ul. Jana Sobieskiego 11', voivodeship: 'slaskie', latitude: 50.2615, longitude: 19.0145, openingHours: standardShopHours },

            // ŁÓDŹ
            { city: 'Łódź', street: 'ul. Narutowicza 38', voivodeship: 'lodzkie', latitude: 51.7715, longitude: 19.4685, openingHours: standardShopHours }
        ]
    });

// 16
    await seedService({
        name: 'Czarnomorka', slug: 'czarnomorka', category: 'gastronomy',
        plDesc: 'Restauracja rybna znana ze świeżych owoców morza.',
        ukDesc: 'Рибний ресторан, відомий свіжими морепродуктами.',
        enDesc: 'Fish restaurant known for fresh seafood.',
        ruDesc: 'Рыбный ресторан, известный свежими морепродуктами.',
        tags: ['seafood', 'tradition'],
        image: 'czarnomorka.png',
        webpage: 'https://czarnomorka.pl/',
        socials: { instagram: 'https://www.instagram.com/czarnomorka/', facebook: 'https://www.facebook.com/czarnomorka.warszawa/' },
        locations: [
            { city: 'Warszawa', street: 'Grzybowska 56', voivodeship: 'mazowieckie', phoneNumber:'+48 722 760 505', latitude: 52.2354, longitude: 20.9876, isMainLocation: true, openingHours: standardGastroHours },
            { city: 'Warszawa', street: 'Nowy Świat 49', voivodeship: 'mazowieckie', phoneNumber:'+48 727 860 505', latitude: 52.2353, longitude: 21.0182, isMainLocation: true, openingHours: standardGastroHours },
            { city: 'Warszawa', street: 'Grzybowska 9', voivodeship: 'mazowieckie', phoneNumber:'+48 727 850 505', latitude: 52.2359, longitude: 20.9992, isMainLocation: true, openingHours: standardGastroHours },
            { city: 'Warszawa', street: 'Hoża 43/49', voivodeship: 'mazowieckie', phoneNumber:'+48 722 700 505', latitude: 52.2269, longitude: 21.0118, isMainLocation: true, openingHours: standardGastroHours },
            { city: 'Wrocław', street: 'Świętego Mikołaja 67', voivodeship: 'dolnoslaskie', phoneNumber:'+48 722 750 505', latitude: 51.1114, longitude: 17.0286, isMainLocation: true, openingHours: standardGastroHours },
            { city: 'Poznań', street: 'Stary Rynek 62', voivodeship: 'wielkopolskie', phoneNumber:'+48 799 495 495', latitude: 52.409, longitude: 16.9338, isMainLocation: true, openingHours: standardGastroHours }
        ]
    });

    // 19
    await seedService({
        name: 'Restauracja U sióstr', slug: 'u-siostr', category: 'gastronomy',
        plDesc: 'Tradycyjna kuchnia ukraińska w sercu Warszawy.',
        ukDesc: 'Традиційна українська кухня в центрі Варшави.',
        enDesc: 'Traditional Ukrainian cuisine in the heart of Warsaw.',
        ruDesc: 'Традиционная украинская кухня в центре Варшавы.',
        webpage: 'https://usiostr.choiceqr.com/',
        image: 'usiostr.png',
        socials: { facebook: 'https://www.facebook.com/usester/?ref=page_internal' },
        tags: ['tradition', 'home'],
        locations: [{ city: 'Warszawa', street: 'Złota 63A', voivodeship: 'mazowieckie', latitude: 52.2305, longitude: 21.0003, phoneNumber: '+48 888 769 423', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 20
    await seedService({
        name: 'Kresowe Smaki Valentyny', slug: 'kresowe-smaki-valentyny', category: 'gastronomy',
        plDesc: 'Domowe smaki Kresów i Ukrainy.',
        ukDesc: 'Домашні страви за традиційними рецептами.',
        enDesc: 'Homemade flavors of Kresy and Ukraine.',
        ruDesc: 'Домашние вкусы Кресов и Украины.',
        image: 'smaki-valentyny.png',
        webpage: 'https://kresowe-smaki-valentyny-sienna89.eatbu.com/',
        socials: { facebook: 'https://www.facebook.com/pages/Kresowe-Smaki-Walentyny/157643074689529', tripadvisor: 'https://www.tripadvisor.com/Restaurant_Review-g274856-d12005947-Reviews-Kresowe_Smaki_Walentyny-Warsaw_Mazovia_Province_Central_Poland.html' },
        tags: ['home', 'tradition'],
        locations: [{ city: 'Warszawa', street: 'Sienna 89', voivodeship: 'mazowieckie', latitude: 52.2302, longitude: 20.9934, phoneNumber: '+48 796 820 030', email: 'witoldgortat@gmail.com', isMainLocation: true, openingHours: standardGastroHours }]
    });



    // 22
    await seedService({
        name: 'Kamanda Lwowska', slug: 'kamanda-lwowska', category: 'gastronomy',
        plDesc: 'Restauracja nawiązująca do przedwojennego klimatu Lwowa.',
        ukDesc: 'Ресторан, що відтворює атмосферу довоєнного Львова.',
        enDesc: 'Restaurant evoking the pre-war atmosphere of Lviv.',
        ruDesc: 'Ресторан, воссоздающий атмосферу довоенного Львова.',
        webpage: 'https://kamandalwowska.pl/',
        image: 'kamanda-lwowa.png',
        socials: { facebook: 'https://www.facebook.com/profile.php?id=61556365557030', instagram: 'https://www.facebook.com/profile.php?id=61556365557030' },
        tags: ['atmosphere', 'culture'],
        locations: [{ city: 'Warszawa', street: 'Foksal 10', voivodeship: 'mazowieckie', latitude: 52.2335, longitude: 21.0219, phoneNumber: '+48 512 240 502', email: 'kontakt@kamandalwowska.pl', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 23
    await seedService({
        name: 'Kozaczok', slug: 'kozaczok', category: 'gastronomy',
        plDesc: 'Ukraiński punkt gastronomiczny.',
        ukDesc: 'Українська кухня у торговому центрі.',
        enDesc: 'Ukrainian food point.',
        ruDesc: 'Украинская кухня в торговом центре.',
        image: 'kozaczok.png',
        webpage: 'https://kozaczok.eatbu.com/',
        socials: { facebook: 'https://www.facebook.com/Kozaczok-165814574084653/' },
        tags: ['lunch', 'dumplings'],
        locations: [
            { city: 'Warszawa', street: 'ul.Sokratesa 9', voivodeship: 'mazowieckie', latitude: 52.2839, longitude: 20.9269, phoneNumber: '+48 535 353 027', isMainLocation: true, openingHours: standardGastroHours },
            { city: 'Warszawa', street: 'C.H. Arkadia al. Jana Pawła II 82', voivodeship: 'mazowieckie', latitude: 52.2565, longitude: 20.9842, phoneNumber: '+48 535 353 027', isMainLocation: true, openingHours: standardGastroHours }
    ]
    });

    // 26
    await seedService({
        name: 'Bistro Kozacka Chatka', slug: 'bistro-kozacka-chatka', category: 'gastronomy',
        plDesc: 'Kultowe miejsce we Wrocławiu.',
        ukDesc: 'Культове місце у Вроцлаві.',
        enDesc: 'Iconic place in Wrocław.',
        ruDesc: 'Культовое место во Вроцлаве.',
        webpage: 'https://kozackachatka.pl/',
        image: 'kozacka-chatka.png',
        socials: { facebook: 'https://www.facebook.com/KozackaChatka', instagram: 'https://www.instagram.com/kozackachatka/', tripadvisor: 'https://www.tripadvisor.com/Restaurant_Review-g274812-d12173535-Reviews-Kozacka_Chatka-Wroclaw_Lower_Silesia_Province_Southern_Poland.html?m=69573' },
        tags: ['tradition', 'culture'],
        locations: [{ city: 'Wrocław', street: 'Energetyczna 14/1b', voivodeship: 'dolnoslaskie', latitude: 51.0913, longitude: 17.0204, phoneNumber: '+48 537 312 298', email: 'biuro@kozackachatka.pl', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 27
    await seedService({
        name: 'Smak Ukraiński', slug: 'smak-ukrainski-krakow', category: 'gastronomy',
        plDesc: 'Klasyki kuchni ukraińskiej.',
        ukDesc: 'Класичні українські страви.',
        enDesc: 'Classics of Ukrainian cuisine.',
        ruDesc: 'Классические украинские блюда.',
        webpage: 'https://ukrainska.pl/',
        image: 'smak-ukraini.png',
        tags: ['tradition', 'lunch'],
        locations: [{ city: 'Kraków', street: 'Grodzka 21', voivodeship: 'malopolskie', latitude: 50.0594, longitude: 19.9381, phoneNumber: '+48 12 421 92 94', email: 'restauracja@ukrainska.pl', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 28
    await seedService({
        name: 'Pan Kotowski', slug: 'pan-kotowski-gdansk', category: 'gastronomy',
        plDesc: 'Kawiarnia i pierogarnia w Gdańsku.',
        ukDesc: 'Кафе та варенична у Гданську.',
        enDesc: 'Cafe and dumpling house in Gdańsk.',
        ruDesc: 'Кафе и вареничная в Гданьске.',
        image: 'pan-kotowski.png',
        webpage: 'https://pan-kotowski-kuchnia-ukrainska.eatbu.com/',
        socials: { instagram: 'https://instagram.com/pankotowski_restaurant?igshid=s9xu5cl4h96r', facebook: 'https://www.facebook.com/KotowskiPan', tiktok: 'https://www.tiktok.com/@pankotowski.gdansk?_t=ZN-8tRdv0b4jxe&_r=1' },
        tags: ['coffee', 'dumplings'],
        locations: [{ city: 'Gdańsk', street: 'Ogarna 11/12', voivodeship: 'pomorskie', latitude: 54.3481, longitude: 18.6508, phoneNumber: '+48 512 060 823', email: 'pankotowski.reservations@gmail.com', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 29
    await seedService({
        name: 'Ukraineczka', slug: 'ukraineczka-szczecin', category: 'gastronomy',
        plDesc: 'Szczecińska restauracja z bogatym menu.',
        ukDesc: 'Ресторан у Щецині з багатим меню.',
        enDesc: 'Szczecin restaurant with a rich menu.',
        ruDesc: 'Ресторан в Щецине с богатым меню.',
        webpage: 'https://www.ukraineczka.com.pl/',
        image: 'ukraineczka.png',
        socials: { facebook: 'https://www.facebook.com/ukraineczkaszczecin/', instagram: 'https://www.instagram.com/restauracja_ukraineczka/' },
        tags: ['culture', 'home'],
        locations: [{ city: 'Szczecin', street: 'Panieńska 19', voivodeship: 'zachodniopomorskie', latitude: 53.4249, longitude: 14.5599, phoneNumber: '+48 603 480 590', email: 'restauracjaukraineczka@wp.pl', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 30
    await seedService({
        name: 'Restauracja Dumka', slug: 'restauracja-dumka-kielce', category: 'gastronomy',
        plDesc: 'Miejsce spotkań z ukraińską kulturą.',
        ukDesc: 'Місце зустрічі з українською культурою.',
        enDesc: 'A meeting place with Ukrainian culture.',
        ruDesc: 'Место встречи с украинской культурой.',
        webpage: 'https://www.dumkarest.pl/',
        image: 'dumka.png',
        socials: { instagram: 'https://www.instagram.com/dumka_restauracja_/' },
        tags: ['culture', 'atmosphere'],
        locations: [{ city: 'Chełm', street: 'Lubelska 17/1', voivodeship: 'lubelskie', latitude: 51.1322, longitude: 23.47611, phoneNumber: '+48 538 344 013', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 31
    await seedService({
        name: 'Kulinarna Ukraina', slug: 'kulinarna-ukraina-gdynia', category: 'gastronomy',
        plDesc: 'Prawdziwe smaki Ukrainy nad morzem.',
        ukDesc: 'Справжні смаки України над морем.',
        enDesc: 'True flavors of Ukraine by the sea.',
        ruDesc: 'Настоящие вкусы Украины у моря.',
        webpage: 'https://kulinarnaukraina.eatbu.com/',
        image: 'kulinarnaukraina.png',
        socials: { facebook: 'https://www.facebook.com/kulinarnaukrainarestaurant/', instagram: 'https://www.instagram.com/kulinarnaukraina/' },
        tags: ['seafood', 'home'],
        locations: [{ city: 'Gdynia', street: 'Świętojańska 66', voivodeship: 'pomorskie', latitude: 54.5165, longitude: 18.5391, phoneNumber: '+48 667 557 757', email: 'restauracja.kulinarnaukraina@onet.pl', isMainLocation: true, openingHours: standardGastroHours }]
    });



    // DODAC KOSCIOLY PRAWOSLAWNE

    // 33
    await seedService({
        name: 'Willa Biała', slug: 'willa-biala-warszawa', category: 'gastronomy',
        plDesc: 'Elegancka restauracja w zabytkowej willi.',
        ukDesc: 'Елегантний ресторан у старій віллі.',
        enDesc: 'Elegant restaurant in a historic villa.',
        ruDesc: 'Элегантный ресторан в старинной вилле.',
        webpage: 'https://willabiala.pl/',
        image: 'willa-biala.png',
        socials: { instagram: 'https://www.instagram.com/willa_biala/', facebook: 'https://www.facebook.com/WillaBiala' },
        tags: ['atmosphere', 'modern'],
        locations: [{ city: 'Warszawa', street: 'Narbutta 10', voivodeship: 'mazowieckie', latitude: 52.2091, longitude: 21.0189, phoneNumber: '+48 577 454 333', email: 'manager@willabiala.pl', isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 36
    await seedService({
        name: 'Serwis UA', slug: 'auto-serwis-ua', category: 'mechanics',
        plDesc: 'Profesjonalny serwis samochodowy.',
        ukDesc: 'Професійне обслуговування авто.',
        enDesc: 'Professional car service.',
        ruDesc: 'Профессиональное обслуживание автомобилей.',
        tags: ['mechanic', 'repair'],
        image: 'serwisua.png',
        locations: [{ city: 'Rybnica', street: 'Rybnica 2B', voivodeship: 'dolnoslaskie', latitude: 51.0592, longitude: 16.8586, isMainLocation: true, openingHours: standardShopHours }],
        webpage: 'https://serwisua.pl/'
    });

    // Fundacja oferująca często bezpłatną pomoc (pro-bono)
    await seedService({
        name: 'Fundacja Ocalenie',
        slug: 'fundacja-ocalenie',
        category: 'law',
        plDesc: 'Bezpłatna pomoc prawna, psychologiczna i kursy języka polskiego dla uchodźców i migrantów.',
        ukDesc: 'Безкоштовна юридична, психологічна допомога та курси польської мови для біженців та мігрантів.',
        enDesc: 'Free legal, psychological assistance and Polish language courses for refugees and migrants.',
        ruDesc: 'Бесплатная юридическая, психологическая помощь и курсы польского языка для беженцев и мигрантов.',
        tags: ['legal', 'culture', 'health'],
        webpage: 'https://ocalenie.org.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Krucza 6/14a', voivodeship: 'mazowieckie', latitude: 52.2315, longitude: 21.0185, openingHours: standardShopHours, isMainLocation: true },
        ]
    });

    // Ukrainoczka
    await seedService({
        name: 'Ukrainoczka',
        slug: 'ukrainoczka',
        category: 'grocery',
        plDesc: 'Sieć sklepów oferująca tradycyjne smaki ze Wschodu. Specjalizuje się w autentycznych wędlinach, rybach, słodyczach oraz produktach garmażeryjnych z Ukrainy, Litwy i Gruzji.',
        ukDesc: 'Мережа магазинів, що пропонує традиційні смаки зі Сходу. Спеціалізується на автентичних м\'ясних виробах, рибі, солодощах та делікатесах з України, Литви та Грузії.',
        enDesc: 'A chain of stores offering traditional Eastern flavors. Specializes in authentic cured meats, fish, sweets and delicacies from Ukraine, Lithuania and Georgia.',
        ruDesc: 'Сеть магазинов, предлагающая традиционные вкусы Востока. Специализируется на аутентичных мясных изделиях, рыбе, сладостях и деликатесах из Украины, Литвы и Грузии.',
        tags: ['grocery', 'imported', 'alcohol', 'seafood'],
        image: 'ukrainooczka.png',
        webpage: 'https://ukrainoczka.pl/nasze-lokalizacje/',
        socials: { facebook: 'https://www.facebook.com/Ukrainoczka', instagram: 'https://www.instagram.com/ukrainoczka_sklep/' },
        locations: [
            // WARSZAWA
            { city: 'Warszawa', street: 'ul. Posag 7 Panien 11', voivodeship: 'mazowieckie', latitude: 52.2035, longitude: 20.8955, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 786 943 768', email: 'sklep@ukrainoczka.pl' },
            { city: 'Warszawa', street: 'ul. Lindleya 16', voivodeship: 'mazowieckie', latitude: 52.2245, longitude: 21.0015, openingHours: standardShopHours },

            // POZNAŃ & OKOLICE
            { city: 'Poznań', street: 'ul. Na miasteczku 12', voivodeship: 'wielkopolskie', latitude: 52.4015, longitude: 16.9485, openingHours: standardShopHours },
            { city: 'Poznań', street: 'ul. Święty Marcin 24', voivodeship: 'wielkopolskie', latitude: 52.4065, longitude: 16.9285, openingHours: standardShopHours },
            { city: 'Swarzędz', street: 'Os. Tytusa Działyńskiego 1h/201', voivodeship: 'wielkopolskie', latitude: 52.4115, longitude: 17.0785, openingHours: standardShopHours },
            { city: 'Środa Wielkopolska', street: 'ul. Wrzosowa 4', voivodeship: 'wielkopolskie', latitude: 52.2315, longitude: 17.2785, openingHours: standardShopHours },

            // WROCŁAW
            { city: 'Wrocław', street: 'ul. Grabiszyńska 269', voivodeship: 'dolnoslaskie', latitude: 51.0925, longitude: 17.0015, openingHours: standardShopHours },
            { city: 'Wrocław', street: 'ul. Jedności Narodowej 169-171', voivodeship: 'dolnoslaskie', latitude: 51.1215, longitude: 17.0455, openingHours: standardShopHours },

            // SZCZECIN & ZACHODNIOPOMORSKIE
            { city: 'Szczecin', street: 'al. Niepodległości 4', voivodeship: 'zachodniopomorskie', latitude: 53.4245, longitude: 14.5515, openingHours: standardShopHours },
            { city: 'Szczecin', street: 'ul. Wiosenna 32', voivodeship: 'zachodniopomorskie', latitude: 53.3985, longitude: 14.6585, openingHours: standardShopHours },
            { city: 'Szczecin', street: 'al. Wyzwolenia 103', voivodeship: 'zachodniopomorskie', latitude: 53.4385, longitude: 14.5555, openingHours: standardShopHours },
            { city: 'Szczecin', street: 'al. Wyzwolenia 37/U2', voivodeship: 'zachodniopomorskie', latitude: 53.4325, longitude: 14.5535, openingHours: standardShopHours },
            { city: 'Stargard', street: 'ul. Piłsudskiego 100', voivodeship: 'zachodniopomorskie', latitude: 53.3385, longitude: 15.0415, openingHours: standardShopHours },
            { city: 'Świnoujście', street: 'Plac Słowiański 14/1b', voivodeship: 'zachodniopomorskie', latitude: 53.9105, longitude: 14.2485, openingHours: standardShopHours },
            { city: 'Koszalin', street: 'ul. Zwycięstwa 7/9', voivodeship: 'zachodniopomorskie', latitude: 54.1915, longitude: 16.1815, openingHours: standardShopHours },

            // LUBUSKIE
            { city: 'Gorzów Wielkopolski', street: 'ul. Sikorskiego 135', voivodeship: 'lubuskie', latitude: 52.7315, longitude: 15.2385, openingHours: standardShopHours },
            { city: 'Gorzów Wielkopolski', street: 'ul. Szarych Szeregów 20b', voivodeship: 'lubuskie', latitude: 52.7515, longitude: 15.2585, openingHours: standardShopHours },
            { city: 'Zielona Góra', street: 'al. Wojska Polskiego 49b', voivodeship: 'lubuskie', latitude: 51.9385, longitude: 15.4915, openingHours: standardShopHours },
            { city: 'Zielona Góra', street: 'ul. Sulechowska 36', voivodeship: 'lubuskie', latitude: 51.9485, longitude: 15.5185, openingHours: standardShopHours },
            { city: 'Świebodzin', street: 'ul. Łużycka 17', voivodeship: 'lubuskie', latitude: 52.2485, longitude: 15.5315, openingHours: standardShopHours },

            // POZOSTAŁE MIASTA
            { city: 'Gdańsk', street: 'ul. Romana Dmowskiego 11F', voivodeship: 'pomorskie', latitude: 54.3815, longitude: 18.6055, openingHours: standardShopHours },
            { city: 'Bydgoszcz', street: 'ul. Dworcowa 23', voivodeship: 'kujawsko-pomorskie', latitude: 53.1285, longitude: 18.0015, openingHours: standardShopHours },
            { city: 'Kalisz', street: 'ul. Zamkowa 14', voivodeship: 'wielkopolskie', latitude: 51.7615, longitude: 18.0915, openingHours: standardShopHours },
            { city: 'Lublin', street: 'ul. Krakowskie Przedmieście 51', voivodeship: 'lubelskie', latitude: 51.2485, longitude: 22.5615, openingHours: standardShopHours },
            { city: 'Kielce', street: 'ul. Sienkiewicza 31', voivodeship: 'swietokrzyskie', latitude: 50.8715, longitude: 20.6315, openingHours: standardShopHours },
            { city: 'Kraków', street: 'os. J. Strusia 1', voivodeship: 'malopolskie', latitude: 50.0885, longitude: 20.0215, openingHours: standardShopHours },
            { city: 'Łódź', street: 'ul. Pojezierska 1A-1B', voivodeship: 'lodzkie', latitude: 51.7985, longitude: 19.4385, openingHours: standardShopHours },
            { city: 'Sosnowiec', street: 'ul. Szklarniana 1', voivodeship: 'slaskie', latitude: 50.2785, longitude: 19.1285, openingHours: standardShopHours },
            { city: 'Chorzów', street: 'ul. Wolności 24', voivodeship: 'slaskie', latitude: 50.2985, longitude: 18.9485, openingHours: standardShopHours },
            { city: 'Gliwice', street: 'ul. Zwycięstwa 27', voivodeship: 'slaskie', latitude: 50.2945, longitude: 18.6685, openingHours: standardShopHours }
        ]
    });

    // --- 9. SZKOŁY JĘZYKOWE (Kategoria: education) ---

    // Lingua City
    await seedService({
        name: 'Lingua City',
        slug: 'lingua-city',
        category: 'education',
        plDesc: 'Szkoła językowa na Śląsku z bogatą ofertą kursów języka polskiego dla osób zza wschodniej granicy, w tym kursy biznesowe.',
        ukDesc: 'Мовна школа на Сілезії з багатою пропозицією курсів польської мови для осіб зі східного кордону, включаючи бізнес-курси.',
        enDesc: 'Language school in Silesia with a rich offer of Polish language courses for people from the eastern border, including business courses.',
        ruDesc: 'Языковая школа в Силезии с богатым предложением курсов польского языка для лиц из-за восточной границы, включая бизнес-курсы.',
        tags: ['polish-courses', 'modern'],
        locations: [
            { city: 'Gliwice', street: 'ul. Zwycięstwa 12', voivodeship: 'slaskie', latitude: 50.2942, longitude: 18.6675, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Katowice', street: 'ul. Mickiewicza 15', voivodeship: 'slaskie', latitude: 50.2595, longitude: 19.0182, openingHours: standardShopHours }
        ]
    });

    // Fundacja "Ocalenie" - Kursy bezpłatne
    await seedService({
        name: 'Kursy Fundacji Ocalenie',
        slug: 'ocalenie-kursy',
        category: 'education',
        plDesc: 'Bezpłatne kursy języka polskiego dla uchodźców i migrantów, prowadzone przez doświadczonych lektorów i wolontariuszy.',
        ukDesc: 'Безкоштовні курси польської мови для біженців та мігрантів, які проводять досвідчені лектори та волонтери.',
        enDesc: 'Free Polish language courses for refugees and migrants, led by experienced teachers and volunteers.',
        ruDesc: 'Бесплатные курсы польского языка для беженцев и мигрантов, проводимые опытными преподавателями и волонтёрами.',
        tags: ['polish-courses', 'ngo'],
        webpage: 'https://ocalenie.org.pl/polski-dla-cudzoziemcow',
        locations: [
            { city: 'Warszawa', street: 'ul. Krucza 6/14a', voivodeship: 'mazowieckie', latitude: 52.2315, longitude: 21.0185, openingHours: standardShopHours, isMainLocation: true }
        ]
    });

    // --- 10. MEDYCYNA I ZDROWIE (Kategoria: health) ---


    // Twój Lekarz w Warszawie (Przychodnia ukraińska)
    const twojLekarzHours = {
        monday: { open: "08:00", close: "21:00" },
        tuesday: { open: "08:00", close: "21:00" },
        wednesday: { open: "08:00", close: "21:00" },
        thursday: { open: "08:00", close: "21:00" },
        friday: { open: "08:00", close: "21:00" },
        saturday: { open: "08:00", close: "21:00" },
        sunday: { open: "08:00", close: "21:00" }
    };
    const twojLekarzMokotowHours = {
        monday: { open: "09:00", close: "21:00" },
        tuesday: { open: "08:00", close: "21:00" },
        wednesday: { open: "08:00", close: "21:00" },
        thursday: { open: "08:00", close: "21:00" },
        friday: { open: "08:00", close: "21:00" },
        saturday: { open: "08:00", close: "21:00" },
        sunday: { open: "08:00", close: "21:00" }
    };
    await seedService({
        name: 'Twój Lekarz w Warszawie',
        slug: 'twoj-lekarz-warszawa',
        category: 'health',
        plDesc: 'Prywatna przychodnia medyczna założona z myślą o pacjentach ukraińskojęzycznych. Kompleksowa opieka: od internisty po ginekologa.',
        ukDesc: 'Приватна медична клініка, створена для україномовних пацієнтів. Комплексна допомога: від терапевta до гінеколога.',
        enDesc: 'Private medical clinic designed for Ukrainian-speaking patients. Comprehensive care: from general practitioner to gynecologist.',
        ruDesc: 'Частная медицинская клиника, созданная для украиноязычных пациентов. Комплексная помощь: от терапевта до гинеколога.',
        tags: ['health', 'doctor', 'pediatrician'],
        webpage: 'https://twojlekarz-wawa.pl/',
        image: 'twoj-lekarz-w-warszawie.png',
        socials: { instagram: 'https://www.instagram.com/doctor.wawa/', facebook: 'https://www.facebook.com/doctor.warszawa/', viber: 'viber://chat?number=+48789809717', telegram: 'https://t.me/Twojlekarz', whatsapp: 'https://wa.me/48600232284' },
        locations: [
            { city: 'Warszawa', street: 'ul. Płosa 3', voivodeship: 'mazowieckie', latitude: 52.2760, longitude: 21.0540, openingHours: twojLekarzHours, isMainLocation: true, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Warszawa', street: 'ul. Arabska 5', voivodeship: 'mazowieckie', latitude: 52.2260, longitude: 21.0830, openingHours: twojLekarzHours, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Warszawa', street: 'ul. Batalionu AK "Parasol" 5/7', voivodeship: 'mazowieckie', latitude: 52.2310, longitude: 20.9510, openingHours: twojLekarzHours, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Warszawa', street: 'ul. Czerniakowska 139', voivodeship: 'mazowieckie', latitude: 52.2090, longitude: 21.0530, openingHours: twojLekarzMokotowHours, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' }
        ]
    });

    // Twój Lekarz w Poznaniu (Przychodnia ukraińska)
    await seedService({
        name: 'Twój Lekarz w Poznaniu',
        slug: 'twoj-lekarz-poznan',
        category: 'health',
        plDesc: 'Prywatna przychodnia medyczna założona z myślą o pacjentach ukraińskojęzycznych. Kompleksowa opieka: od internisty po ginekologa.',
        ukDesc: 'Приватна медична клініка, створена для україномовних пацієнтів. Комплексна допомога: від терапевта до гінеколога.',
        enDesc: 'Private medical clinic designed for Ukrainian-speaking patients. Comprehensive care: from general practitioner to gynecologist.',
        ruDesc: 'Частная медицинская клиника, созданная для украиноязычных пациентов. Комплексная помощь: от терапевта до гинеколога.',
        tags: ['health', 'doctor', 'pediatrician'],
        webpage: 'https://twojlekarz-wawa.pl/poznan',
        image: 'twoj-lekarz-w-warszawie.png',
        socials: { instagram: 'https://www.instagram.com/doctor.poznan/', facebook: 'https://www.facebook.com/doctor.poznan/', viber: 'viber://chat?number=+48789809717', telegram: 'https://t.me/doctorpoznan', whatsapp: 'https://wa.me/48510533353' },
        locations: [
            { city: 'Poznań', street: 'ul. Święty Marcin 46/50', voivodeship: 'wielkopolskie', latitude: 52.4065, longitude: 16.9305, openingHours: twojLekarzHours, isMainLocation: true, phoneNumber: '+48 510 313 232', email: 'sekretariat@twojlekarz-wawa.pl' }
        ]
    });

    // Twój Lekarz w Krakowie (Przychodnia ukraińska)
    await seedService({
        name: 'Twój Lekarz w Krakowie',
        slug: 'twoj-lekarz-krakow',
        category: 'health',
        plDesc: 'Prywatna przychodnia medyczna założona z myślą o pacjentach ukraińskojęzycznych. Kompleksowa opieka: od internisty po ginekologa.',
        ukDesc: 'Приватна медична клініка, створена для україномовних пацієнтів. Комплексна допомога: від терапевта до гінеколога.',
        enDesc: 'Private medical clinic designed for Ukrainian-speaking patients. Comprehensive care: from general practitioner to gynecologist.',
        ruDesc: 'Частная медицинская клиника, созданная для украиноязычных пациентов. Комплексная помощь: от терапевта до гинеколога.',
        tags: ['health', 'doctor', 'pediatrician'],
        webpage: 'https://twojlekarz-wawa.pl/krakow',
        image: 'twoj-lekarz-w-warszawie.png',
        socials: { instagram: 'https://www.instagram.com/doctor.krakow/', facebook: 'https://www.facebook.com/twojlekarz.krakow/', viber: 'viber://chat?number=+48500639363', telegram: 'https://t.me/doctorkrakow', whatsapp: 'https://wa.me/48500639363' },
        locations: [
            { city: 'Kraków', street: 'ul. Mogilska 65', voivodeship: 'malopolskie', latitude: 50.0645, longitude: 19.9685, openingHours: twojLekarzHours, isMainLocation: true, phoneNumber: '+48 736 407 192', email: 'sekretariat@twojlekarz-wawa.pl' }
        ]
    });

    // Twój Lekarz w Trójmieście (Przychodnia ukraińska)
    await seedService({
        name: 'Twój Lekarz w Trójmieście',
        slug: 'twoj-lekarz-trojmiasto',
        category: 'health',
        plDesc: 'Prywatna przychodnia medyczna założona z myślą o pacjentach ukraińskojęzycznych. Kompleksowa opieka: od internisty po ginekologa.',
        ukDesc: 'Приватна медична клініка, створена для україномовних пацієнтів. Комплексна допомога: від терапевта до гінеколога.',
        enDesc: 'Private medical clinic designed for Ukrainian-speaking patients. Comprehensive care: from general practitioner to gynecologist.',
        ruDesc: 'Частная медицинская клиника, созданная для украиноязычных пациентов. Комплексная помощь: от терапевта до гинеколога.',
        tags: ['health', 'doctor', 'pediatrician'],
        webpage: 'https://twojlekarz-wawa.pl/trojmiasto',
        image: 'twoj-lekarz-w-warszawie.png',
        socials: { instagram: 'https://www.instagram.com/doctor.trojmiasto/', facebook: 'https://www.facebook.com/doctor.trojmiasto/', viber: 'viber://chat?number=+48789809717', telegram: 'https://t.me/joinchat/AAAAAFH9jgxlHtx11_BrTQ', whatsapp: 'https://wa.me/48536426220' },
        locations: [
            { city: 'Gdańsk', street: 'ul. Uphagena 27', voivodeship: 'pomorskie', latitude: 54.3755, longitude: 18.6185, openingHours: twojLekarzHours, isMainLocation: true, phoneNumber: '+48 536 426 220', email: 'sekretariat@twojlekarz-wawa.pl' }
        ]
    });

    // Twój Lekarz we Wrocławiu (Przychodnia ukraińska)
    await seedService({
        name: 'Twój Lekarz we Wrocławiu',
        slug: 'twoj-lekarz-wroclaw',
        category: 'health',
        plDesc: 'Prywatna przychodnia medyczna założona z myślą o pacjentach ukraińskojęzycznych. Kompleksowa opieka: od internisty po ginekologa.',
        ukDesc: 'Приватна медична клініка, створена для україномовних пацієнтів. Комплексна допомога: від терапевта до гінеколога.',
        enDesc: 'Private medical clinic designed for Ukrainian-speaking patients. Comprehensive care: from general practitioner to gynecologist.',
        ruDesc: 'Частная медицинская клиника, созданная для украиноязычных пациентов. Комплексная помощь: от терапевта до гинеколога.',
        tags: ['health', 'doctor', 'pediatrician'],
        webpage: 'https://twojlekarz-wawa.pl/wroclaw',
        image: 'twoj-lekarz-w-warszawie.png',
        socials: { instagram: 'https://www.instagram.com/doctor.wroclaw/', facebook: 'https://www.facebook.com/doctor.wroclaw/', viber: 'viber://chat?number=+48786600160', telegram: 'https://t.me/doctorwroclaw', whatsapp: 'https://wa.me/48786600160' },
        locations: [
            { city: 'Wrocław', street: 'ul. Bezpieczna 2', voivodeship: 'dolnoslaskie', latitude: 51.1385, longitude: 17.0565, openingHours: twojLekarzHours, isMainLocation: true, phoneNumber: '+48 510 551 855', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Wrocław', street: 'ul. Ślężna 102', voivodeship: 'dolnoslaskie', latitude: 51.0905, longitude: 17.0245, openingHours: twojLekarzHours, phoneNumber: '+48 510 551 855', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Wrocław', street: 'ul. Świętego Mikołaja 18/20', voivodeship: 'dolnoslaskie', latitude: 51.1105, longitude: 17.0305, openingHours: twojLekarzHours, phoneNumber: '+48 510 551 855', email: 'sekretariat@twojlekarz-wawa.pl' }
        ]
    });

    // Accounting & Tax - Spółki i JDG
    await seedService({
        name: 'Progress Holding - Księgowość i Finanse',
        slug: 'progress-holding',
        category: 'financial',
        plDesc: 'Biuro rachunkowe specjalizujące się w obsłudze ukraińskiego biznesu w Polsce. Doradztwo podatkowe, optymalizacja i zakładanie spółek.',
        ukDesc: 'Бухгалтерія, що спеціалізується на обслуговуванні українського бізнесу в Польщі. Податкові консультації, оптимізація та реєстрація компаній.',
        enDesc: 'Accounting office specializing in serving Ukrainian businesses in Poland. Tax consulting, optimization and company registration.',
        ruDesc: 'Бухгалтерия, специализирующаяся на обслуживании украинского бизнеса в Польше. Налоговые консультации, оптимизация и регистрация компаний.',
        tags: ['legal', 'documents'],
        webpage: 'https://progressholding.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Nowogrodzka 31', voivodeship: 'mazowieckie', latitude: 52.2295, longitude: 21.0115, openingHours: standardShopHours, isMainLocation: true }
        ]
    });

    await seedService({
        name: 'Ukraińsko-Polska Izba Gospodarcza',
        slug: 'upig-biznes',
        category: 'financial',
        plDesc: 'Organizacja wspierająca współpracę gospodarczą. Doradztwo w zakresie inwestycji, pozyskiwania finansowania i networkingu biznesowego.',
        ukDesc: 'Організація, що підтримує економічну співпрацю. Консультування з питань інвестицій, залучення фінансування та ділового нетворкінгу.',
        enDesc: 'Organization supporting economic cooperation. Consulting on investments, fundraising and business networking.',
        ruDesc: 'Организация, поддерживающая экономическое сотрудничество. Консультирование по вопросам инвестиций, привлечения финансирования и делового нетворкинга.',
        tags: ['ngo', 'legal', 'modern'],
        webpage: 'https://pol-ukr.com/',
        locations: [
            { city: 'Warszawa', street: 'ul. Szpitalna 5', voivodeship: 'mazowieckie', latitude: 52.2345, longitude: 21.0145, openingHours: standardShopHours, isMainLocation: true }
        ]
    });

    await seedService({
        name: 'Teatr Navpaky',
        slug: 'teatr-navpaky',
        category: 'entertainment',
        plDesc: 'Jedyny teatr w Polsce z regularnym repertuarem w języku ukraińskim. Tworzony przez profesjonalnych aktorów, łączy tradycję z nowoczesną formą sceniczną.',
        ukDesc: 'Єдиний театр у Польщі з регулярним репертуаром українською мовою. Створений професійними акторами, він поєднує традиції з сучасною сценічною формою.',
        enDesc: 'The only theater in Poland with a regular repertoire in Ukrainian. Created by professional actors, it combines tradition with modern stage form.',
        ruDesc: 'Единственный театр в Польше с регулярным репертуаром на украинском языке. Создан профессиональными актёрами, сочетает традиции с современной сценической формой.',
        tags: ['ngo', 'culture', 'atmosphere'],
        webpage: 'https://www.facebook.com/teatrnavpaky/',
        locations: [
            { city: 'Gdynia', street: 'ul. Bema 26 (Konsulat Kultury)', voivodeship: 'pomorskie', latitude: 54.5165, longitude: 18.5385, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Gdańsk', street: 'ul. Grunwaldzka 199', voivodeship: 'pomorskie', latitude: 54.3895, longitude: 18.5945, openingHours: standardShopHours }
        ]
    });


    // await seedService({
    //     name: 'Sindbad',
    //     slug: 'sindbad',
    //     category: 'transport',
    //     plDesc: 'Międzynarodowy przewoźnik autokarowy – połączenia m.in. z Polski do miast w Ukrainie.',
    //     ukDesc: 'Міжнародний автобусний перевізник – рейси, зокрема з Польщі до міст України.',
    //     webpage: 'https://sindbad.pl/',
    //     image: 'sindbad.png',
    //     tags: ['bus', 'passenger', 'poland-ukraine', 'international'],
    //     locations: [
    //         {
    //             city: 'Opole',
    //             street: 'ul. Podróżnicza 2',
    //             voivodeship: 'opolskie',
    //             latitude: 50.6640,
    //             longitude: 17.9290,
    //             isMainLocation: true,
    //         }
    //     ]
    // });
    //
    // await seedService({
    //     name: 'ECOLINES',
    //     slug: 'ecolines',
    //     category: 'transport',
    //     plDesc: 'Międzynarodowe połączenia autokarowe – obsługa tras m.in. Polska ↔ Ukraina (w zależności od rozkładu).',
    //     ukDesc: 'Міжнародні автобусні перевезення – маршрути, зокрема Польща ↔ Україна (залежно від розкладу).',
    //     webpage: 'https://ecolines.net/',
    //     image: 'ecolines.png',
    //     tags: ['bus', 'passenger', 'poland-ukraine', 'international'],
    //     locations: [
    //         {
    //             city: 'Białystok',
    //             street: 'ul. Bohaterów Monte Cassino 8',
    //             voivodeship: 'podlaskie',
    //             latitude: 53.1324,
    //             longitude: 23.1359,
    //             isMainLocation: true,
    //         }
    //     ]
    // });
    //
    // // --- Parcels / courier ---
    // await seedService({
    //     name: 'Meest (Meest Post / Meest Express)',
    //     slug: 'meest',
    //     category: 'courier',
    //     plDesc: 'Operator logistyczny specjalizujący się m.in. w przesyłkach międzynarodowych do Ukrainy.',
    //     ukDesc: 'Логістичний оператор, що спеціалізується, зокрема, на міжнародних відправленнях до України.',
    //     webpage: 'https://meest.com/',
    //     image: 'meest.png',
    //     tags: ['parcels', 'courier', 'poland-ukraine', 'international'],
    //     locations: [
    //         {
    //             city: 'Zielona Góra',
    //             street: 'ul. Kożuchowska 20C',
    //             voivodeship: 'lubuskie',
    //             latitude: 51.9355,
    //             longitude: 15.5064,
    //             isMainLocation: true,
    //         }
    //     ]
    // });
    //
    // await seedService({
    //     name: 'UPS',
    //     slug: 'ups',
    //     category: 'courier',
    //     plDesc: 'Międzynarodowy kurier – przesyłki z Polski do Ukrainy (usługi międzynarodowe).',
    //     ukDesc: 'Міжнародний кур’єр – відправлення з Польщі до України (міжнародні послуги).',
    //     webpage: 'https://www.ups.com/pl/pl/Home.page',
    //     image: 'ups.png',
    //     tags: ['parcels', 'courier', 'poland-ukraine', 'international'],
    //     locations: [
    //         {
    //             city: 'Warszawa',
    //             street: 'ul. Ignacego Prądzyńskiego 1/3',
    //             voivodeship: 'mazowieckie',
    //             latitude: 52.223311,
    //             longitude: 20.968148,
    //             isMainLocation: true,
    //         }
    //     ]
    // });
    //
    // await seedService({
    //     name: 'FedEx',
    //     slug: 'fedex',
    //     category: 'courier',
    //     plDesc: 'Międzynarodowy kurier ekspresowy – wysyłki międzynarodowe z Polski do Ukrainy.',
    //     ukDesc: 'Міжнародний експрес-кур’єр – міжнародні відправлення з Польщі до України.',
    //     webpage: 'https://www.fedex.com/pl-pl/home.html',
    //     image: 'fedex.png',
    //     tags: ['parcels', 'courier', 'express', 'poland-ukraine'],
    //     locations: [
    //         {
    //             city: 'Warszawa',
    //             street: 'ul. Wolska 64A',
    //             voivodeship: 'mazowieckie',
    //             latitude: 52.2334128,
    //             longitude: 20.9638178,
    //             isMainLocation: true,
    //         }
    //     ]
    // });

    // --- PRAWO / KANCELARIE ---

    await seedService({
        name: 'Ukrainian Desk – Traple Konarski Podrecki',
        slug: 'ukrainian-desk-tkp',
        category: 'law',
        plDesc: 'Kancelaria prawna z 25-letnim doświadczeniem oferująca kompleksową obsługę prawną dla osób i firm z Ukrainy prowadzących działalność w Polsce. Pomoc w zakładaniu biznesu, prawie pracy i relacjach z administracją publiczną.',
        ukDesc: 'Юридична фірма з 25-річним досвідом, що надає комплексний правовий супровід для осіб та компаній з України, які ведуть бізнес у Польщі. Допомога у відкритті бізнесу, трудовому праві та відносинах з державними органами.',
        enDesc: 'Law firm with 25 years of experience offering comprehensive legal services for individuals and companies from Ukraine doing business in Poland. Assistance with starting a business, labor law and relations with public administration.',
        ruDesc: 'Юридическая фирма с 25-летним опытом, предоставляющая комплексное правовое сопровождение для лиц и компаний из Украины, ведущих бизнес в Польше. Помощь в открытии бизнеса, трудовом праве и отношениях с государственными органами.',
        webpage: 'https://www.traple.pl/ukrainian-desk-tkp/',
        image: 'ukrainian-desk-traple-konarski-podrecki.png',
        tags: ['legal', 'documents'],
        locations: [
            {
                city: 'Kraków',
                street: 'ul. Królowej Jadwigi 170',
                voivodeship: 'malopolskie',
                latitude: 50.0555,
                longitude: 19.9055,
                phoneNumber: '+48 12 426 05 30',
                email: 'office@traple.pl',
                isMainLocation: true,
                openingHours: standardShopHours,
            },
            {
                city: 'Warszawa',
                street: 'ul. Twarda 4',
                voivodeship: 'mazowieckie',
                latitude: 52.2325,
                longitude: 20.9995,
                phoneNumber: '+48 22 850 10 10',
                email: 'office@traple.pl',
                openingHours: standardShopHours,
            },
        ],
    });

    await seedService({
        name: 'Kancelaria Adwokacka Adwokat Oxana Piątkowska',
        slug: 'adwokat-piatkowska',
        category: 'law',
        plDesc: 'Kompleksowe usługi prawne dla przedsiębiorców i klientów indywidualnych w językach polskim, ukraińskim i rosyjskim. Specjalizacja: prawo handlowe, cywilne, karne, administracyjne, obsługa cudzoziemców oraz prawo podatkowe.',
        ukDesc: 'Комплексні юридичні послуги для підприємців та приватних клієнтів польською, українською та російською мовами. Спеціалізація: комерційне, цивільне, кримінальне, адміністративне право, обслуговування іноземців та податкове право.',
        enDesc: 'Comprehensive legal services for entrepreneurs and individual clients in Polish, Ukrainian and Russian. Specialization: commercial, civil, criminal, administrative law, foreigners\' services and tax law.',
        ruDesc: 'Комплексные юридические услуги для предпринимателей и частных клиентов на польском, украинском и русском языках. Специализация: коммерческое, гражданское, уголовное, административное право, обслуживание иностранцев и налоговое право.',
        webpage: 'https://www.adwokatpiatkowska.pl/',
        image: 'kancelaria-adwokacka-adwokat-oxana-piatkowska.png',
        tags: ['legal', 'documents'],
        locations: [
            {
                city: 'Warszawa',
                street: 'ul. Krakowskie Przedmieście 41',
                voivodeship: 'mazowieckie',
                latitude: 52.2445087,
                longitude: 21.0138772,
                phoneNumber: '+48 22 465 17 17',
                whatsappNumber: '+48 698 641 555',
                email: 'kancelaria@adwokatpiatkowska.pl',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '10:00', close: '17:00' },
                    tuesday: { open: '10:00', close: '17:00' },
                    wednesday: { open: '10:00', close: '17:00' },
                    thursday: { open: '10:00', close: '17:00' },
                    friday: { open: '10:00', close: '17:00' },
                },
            },
        ],
    });

    await seedService({
        name: 'Kancelaria Wschodnia – Adwokat Olga Dugil',
        slug: 'kancelaria-wschodnia-dugil',
        category: 'law',
        plDesc: 'Kancelaria specjalizująca się w prawie wschodnioeuropejskim (Ukraina, Rosja, Białoruś, Kazachstan) z 20-letnim doświadczeniem. Rejestracja firm, legalizacja pracowników, obsługa celna, reprezentacja przed sądami i urzędami.',
        ukDesc: 'Юридична фірма, що спеціалізується на східноєвропейському праві (Україна, Росія, Білорусь, Казахстан) з 20-річним досвідом. Реєстрація компаній, легалізація працівників, митне оформлення, представництво в судах та органах влади.',
        enDesc: 'Law firm specializing in Eastern European law (Ukraine, Russia, Belarus, Kazakhstan) with 20 years of experience. Company registration, employee legalization, customs handling, representation in courts and offices.',
        ruDesc: 'Юридическая фирма, специализирующаяся на восточноевропейском праве (Украина, Россия, Беларусь, Казахстан) с 20-летним опытом. Регистрация компаний, легализация работников, таможенное оформление, представительство в судах и органах власти.',
        webpage: 'https://dugilolga.pl/pl',
        socials: { facebook: 'https://www.facebook.com/dugilolga.eu/', linkedin: 'https://www.linkedin.com/in/olga-dugil/' },
        tags: ['legal', 'documents'],
        locations: [
            {
                city: 'Warszawa',
                street: 'ul. Krakowskie Przedmieście',
                voivodeship: 'mazowieckie',
                latitude: 52.244,
                longitude: 21.014,
                phoneNumber: '+48 608 115 622',
                whatsappNumber: '+48 608 115 622',
                email: 'office@dugilolga.pl',
                isMainLocation: true,
                openingHours: standardShopHours,
            },
        ],
    });

    await seedService({
        name: 'Kancelaria Radcy Prawnego Piotr Kamler',
        slug: 'kancelaria-kamler',
        category: 'law',
        plDesc: 'Kancelaria radcy prawnego specjalizująca się w pomocy prawnej dla obywateli Ukrainy. Legalizacja pobytu, zezwolenia na pracę, pobyt tymczasowy, zakładanie firm oraz konsultacje z zakresu prawa administracyjnego.',
        ukDesc: 'Юридична фірма, що спеціалізується на правовій допомозі громадянам України. Легалізація перебування, дозволи на роботу, тимчасове проживання, реєстрація фірм та консультації з адміністративного права.',
        enDesc: 'Legal counsel office specializing in legal assistance for Ukrainian citizens. Legalization of stay, work permits, temporary residence, company registration and administrative law consultations.',
        ruDesc: 'Юридическая фирма, специализирующаяся на правовой помощи гражданам Украины. Легализация пребывания, разрешения на работу, временное проживание, регистрация фирм и консультации по административному праву.',
        webpage: 'https://kancelariakamler.pl/pomoc-prawna-dla-obywateli-ukrainy',
        image: 'kancelaria-radcy-prawnego-piotr-kamler.png',
        socials: { facebook: 'https://www.facebook.com/kancelaria.radcy.prawnego.piotr.kamler' },
        tags: ['legal', 'documents'],
        locations: [
            {
                city: 'Wrocław',
                street: 'al. Armii Krajowej 12B/3',
                voivodeship: 'dolnoslaskie',
                latitude: 51.1100,
                longitude: 16.9930,
                phoneNumber: '+48 608 882 171',
                email: 'biuro@kancelariakamler.pl',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '09:00', close: '17:00' },
                    tuesday: { open: '09:00', close: '17:00' },
                    wednesday: { open: '09:00', close: '17:00' },
                    thursday: { open: '09:00', close: '17:00' },
                    friday: { open: '09:00', close: '17:00' },
                },
            },
        ],
    });

    // --- TRANSPORT MIĘDZYNARODOWY (Polska ↔ Ukraina) ---

    await seedService({
        name: 'INTER-LOGISTIC',
        slug: 'inter-logistic',
        category: 'transport',
        plDesc: 'Międzynarodowa spedycja i transport drogowy na kierunku Ukraina ↔ Polska/UE; obsługa m.in. FTL/LTL oraz wsparcie organizacyjne przy przewozach.',
        ukDesc: 'Міжнародна експедиція та автоперевезення напрямком Україна ↔ Польща/ЄС; зокрема FTL/LTL та організаційний супровід перевезень.',
        enDesc: 'International forwarding and road transport on the Ukraine ↔ Poland/EU route; including FTL/LTL and organizational support for shipments.',
        ruDesc: 'Международная экспедиция и автоперевозки по направлению Украина ↔ Польша/ЕС; включая FTL/LTL и организационное сопровождение перевозок.',
        webpage: 'https://inter-logistic.pl/zasieg-dzialania-2/transport-ukraina/',
        image: 'inter-logistic.png',
        tags: ['freight', 'road-transport', 'spedycja', 'poland-ukraine', 'international', 'ftl', 'ltl'],
        locations: [
            {
                city: 'Gliwice',
                street: 'ul. Portowa 28',
                voivodeship: 'slaskie',
                latitude: 50.29761,
                longitude: 18.67658,
                phoneNumber: '+48 32 331 67 30',
                email: 'biuro@inter-logistic.pl',
                isMainLocation: true,
                openingHours: standardShopHours,
            },
        ],
    });

    await seedService({
        name: 'GONERA TRANSPORT I SPEDYCJA',
        slug: 'gonera-transport',
        category: 'transport',
        plDesc: 'Transport Polska ↔ Ukraina: kompleksowe usługi przewozowe (m.in. niskopodwoziowy, FTL/LTL, kontenery, maszyny) z obsługą formalną i logistyczną.',
        ukDesc: 'Перевезення Польща ↔ Україна: комплексні транспортні послуги (зокрема низькорамні, FTL/LTL, контейнери, техніка) з логістичним та документальним супроводом.',
        enDesc: 'Transport Poland ↔ Ukraine: comprehensive transport services (including low-bed, FTL/LTL, containers, machinery) with formal and logistics support.',
        ruDesc: 'Перевозки Польша ↔ Украина: комплексные транспортные услуги (включая низкорамные, FTL/LTL, контейнеры, техника) с логистическим и документальным сопровождением.',
        webpage: 'https://gonera-transport.pl/transport-polska-ukraina/',
        image: 'gonera-transport-i-spedycja.png',
        tags: ['freight', 'road-transport', 'spedycja', 'poland-ukraine', 'international', 'ftl', 'ltl', 'oversize'],
        locations: [
            {
                city: 'Międzybórz',
                street: 'Bukowina Sycowska 58/4',
                voivodeship: 'dolnoslaskie',
                latitude: 51.38483,
                longitude: 17.57266,
                phoneNumber: '+48 534 531 513',
                email: 'zapytania@gonera-transport.pl',
                isMainLocation: true,
                openingHours: standardShopHours,
            },
        ],
    });

    await seedService({
        name: 'OMIDA VLS',
        slug: 'omida-vls',
        category: 'transport',
        plDesc: 'Transport Polska ↔ Ukraina: usługi TSL (FTL/LTL), organizacja transportu drogowego i spedycji na kierunku Ukraina.',
        ukDesc: 'Перевезення Польща ↔ Україна: TSL (FTL/LTL), організація автоперевезень та експедиції на українському напрямку.',
        enDesc: 'Transport Poland ↔ Ukraine: TSL services (FTL/LTL), road transport and forwarding organization on the Ukraine route.',
        ruDesc: 'Перевозки Польша ↔ Украина: услуги TSL (FTL/LTL), организация автоперевозок и экспедиции на украинском направлении.',
        webpage: 'https://omida.pl/transport-polska-ukraina/',
        image: 'omida.png',
        tags: ['freight', 'road-transport', 'spedycja', 'poland-ukraine', 'international', 'ftl', 'ltl'],
        locations: [
            {
                city: 'Gdańsk',
                street: 'Aleja Grunwaldzka 472C',
                voivodeship: 'pomorskie',
                latitude: 54.402948,
                longitude: 18.571977,
                phoneNumber: '+48 58 741 88 14',
                email: 'bok@omida-vls.com',
                isMainLocation: true,
                openingHours: standardShopHours,
            },
        ],
    });

    await seedService({
        name: 'TTE (TRADE & TRANS EXPERT)',
        slug: 'tte',
        category: 'transport',
        plDesc: 'Transport na Ukrainę: spedycja i transport międzynarodowy (organizacja przewozów drogowych oraz obsługa logistyczna).',
        ukDesc: 'Перевезення в Україну: міжнародна експедиція та транспорт (організація автоперевезень і логістичний супровід).',
        enDesc: 'Transport to Ukraine: international forwarding and transport (road transport organization and logistics support).',
        ruDesc: 'Перевозки в Украину: международная экспедиция и транспорт (организация автоперевозок и логистическое сопровождение).',
        webpage: 'https://tte.pl/transport-na-ukraine/',
        image: 'tte-trade-and-trans-expert.png',
        tags: ['freight', 'road-transport', 'spedycja', 'poland-ukraine', 'international', 'ukraine'],
        locations: [
            {
                city: 'Sławków',
                street: 'ul. Dębowa Góra 29',
                voivodeship: 'slaskie',
                latitude: 50.28,
                longitude: 19.361944,
                phoneNumber: '+48 32 719 61 84',
                email: 'biuro@tte.pl',
                isMainLocation: true,
                openingHours: standardShopHours,
            },
        ],
    });

    await seedService({
        name: 'BIAL-MICH',
        slug: 'bial-mich',
        category: 'transport',
        plDesc: 'Transport Polska ↔ Ukraina oraz spedycja międzynarodowa: kompleksowa organizacja przewozu towarów z naciskiem na terminowość i bezpieczeństwo.',
        ukDesc: 'Перевезення Польща ↔ Україна та міжнародна експедиція: комплексна організація доставки вантажів з акцентом на безпеку і своєчасність.',
        enDesc: 'Transport Poland ↔ Ukraine and international forwarding: comprehensive cargo transport organization with focus on timeliness and safety.',
        ruDesc: 'Перевозки Польша ↔ Украина и международная экспедиция: комплексная организация доставки грузов с акцентом на безопасность и своевременность.',
        webpage: 'https://bialmich.com/nasze-uslugi/spedycja-miedzynarodowa/transport-ukraina/',
        image: 'bialmich.png',
        tags: ['freight', 'road-transport', 'spedycja', 'poland-ukraine', 'international', 'customs'],
        locations: [
            {
                city: 'Biała Podlaska',
                street: 'Sławacinek Nowy 5ab',
                voivodeship: 'lubelskie',
                latitude: 52.0343873788573,
                longitude: 23.1287264910183,
                phoneNumber: '+48 83 343 27 30',
                email: 'biuro@bialmich.pl',
                isMainLocation: true,
                openingHours: standardShopHours,
            },
        ],
    });

    // WixMart (Delikatesy Świata)
    await seedService({
        name: 'WixMart',
        slug: 'wixmart',
        category: 'grocery',
        plDesc: 'Sieć sklepów z ukraińskimi i litewskimi produktami spożywczymi. Specjalizuje się w rybach, owocach morza i delikatesach ze Wschodu.',
        ukDesc: 'Мережа магазинів з українськими та литовськими продуктами. Спеціалізується на рибі, морепродуктах та делікатесах зі Сходу.',
        enDesc: 'Chain of stores with Ukrainian and Lithuanian food products. Specializes in fish, seafood and Eastern delicacies.',
        ruDesc: 'Сеть магазинов с украинскими и литовскими продуктами. Специализируется на рыбе, морепродуктах и деликатесах с Востока.',
        tags: ['grocery', 'imported', 'seafood'],
        webpage: 'https://wixmart.pl/',
        image: 'wixmart.png',
        socials: { instagram: 'https://www.instagram.com/wixmart.pl/' },
        locations: [
            { city: 'Warszawa', street: 'ul. Pory 55', voivodeship: 'mazowieckie', latitude: 52.1925, longitude: 20.9985, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 887 156 737', email: 'info@wixmart.pl' },
            { city: 'Pruszków', street: 'ul. Kraszewskiego 44', voivodeship: 'mazowieckie', latitude: 52.1685, longitude: 20.8035, openingHours: standardShopHours },
            { city: 'Sochaczew', street: 'ul. Płocka 40A', voivodeship: 'mazowieckie', latitude: 52.2315, longitude: 20.2385, openingHours: standardShopHours },
            { city: 'Błonie', street: 'ul. Warszawska 8', voivodeship: 'mazowieckie', latitude: 52.1985, longitude: 20.6175, openingHours: standardShopHours },
            { city: 'Płock', street: 'ul. Tumska 15', voivodeship: 'mazowieckie', latitude: 52.5465, longitude: 19.7065, openingHours: standardShopHours }
        ]
    });

    // --- Booksy: beauty / nails (manual pick) ---

    await seedService({
        name: 'Manièra face bar + nail',
        slug: 'maniera-face-bar-nail',
        category: 'beauty',
        plDesc: 'Salon beauty (nails + pielęgnacja) dostępny do rezerwacji na Booksy.',
        ukDesc: 'Б’юті-салон (нігті та догляд), доступний для запису в Booksy.',
        enDesc: 'Beauty salon (nails + care) bookable on Booksy.',
        ruDesc: 'Бьюти-салон (ногти + уход), доступен для записи в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://booksy.com/pl-pl/106267_maniera-face-bar-nail_salon-kosmetyczny_3_warszawa',
        image: 'booksy-maniera.png',
        locations: [
            {
                city: 'Warszawa',
                street: 'Mokotowska 39',
                voivodeship: 'mazowieckie',
                latitude: 52.22261,
                longitude: 21.0195,
                openingHours: standardShopHours,
                isMainLocation: true,
            },
        ],
    });

    await seedService({
        name: 'WeroNAILka',
        slug: 'weronailka',
        category: 'beauty',
        plDesc: 'Studio paznokci (manicure/pedicure) dostępne do rezerwacji na Booksy.',
        ukDesc: 'Студія нігтів (манікюр/педикюр), доступна для запису в Booksy.',
        enDesc: 'Nail studio (manicure/pedicure) bookable on Booksy.',
        ruDesc: 'Студия ногтей (маникюр/педикюр), доступна для записи в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://booksy.com/pl-pl/250481_weronailka_paznokcie_3_warszawa',
        image: 'booksy-weronailka.png',
        locations: [
            {
                city: 'Warszawa',
                street: 'Podskarbińska 34/u2',
                voivodeship: 'mazowieckie',
                latitude: 52.255,
                longitude: 21.0741,
                openingHours: standardShopHours,
            },
        ],
    });

    await seedService({
        name: 'manicure & pedicure',
        slug: 'manicure-and-pedicure-krakow',
        category: 'beauty',
        plDesc: 'Salon paznokci w Krakowie dostępny do rezerwacji na Booksy.',
        ukDesc: 'Салон нігтів у Кракові, доступний для запису в Booksy.',
        enDesc: 'Nail salon in Kraków bookable on Booksy.',
        ruDesc: 'Салон ногтей в Кракове, доступен для записи в Booksy.',
        tags: ['beauty', 'nails'],
        image: "manicure-and-pedicure.png",
        webpage: 'https://booksy.com/pl-pl/243436_manicure-pedicure_paznokcie_8820_krakow',
        image: 'booksy-manicure-pedicure-krakow.png',
        locations: [
            {
                city: 'Kraków',
                street: 'Starowiślna 19',
                voivodeship: 'malopolskie',
                latitude: 50.057,
                longitude: 19.944,
                openingHours: standardShopHours,
                isMainLocation: true,
            },
        ],
    });

    await seedService({
        name: 'MANIPEDI',
        slug: 'manipedi-krakow',
        category: 'beauty',
        plDesc: 'Salon manicure/pedicure w Galerii Krakowskiej – rezerwacje na Booksy.',
        ukDesc: 'Салон манікюру/педикюру в Galeria Krakowska — запис у Booksy.',
        enDesc: 'Manicure/pedicure salon in Galeria Krakowska – bookable on Booksy.',
        ruDesc: 'Салон маникюра/педикюра в Galeria Krakowska — запись в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://booksy.com/pl-pl/303134_manipedi_salon-kosmetyczny_8820_krakow',
        image: 'manipedi.png',
        locations: [
            {
                city: 'Kraków',
                street: 'Pawia 5, Galeria Krakowska',
                voivodeship: 'malopolskie',
                latitude: 50.0664,
                longitude: 19.946,
                openingHours: standardShopHours,
            },
        ],
    });


    console.log('✅ Seed zakończony z tagami!');
}


mainSeed()
    .catch((err) => {
        console.error('❌ Błąd:', err);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });