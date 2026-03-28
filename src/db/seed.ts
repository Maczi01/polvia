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
        Kraków: { lat: 50.0647, lon: 19.945 },
        Wrocław: { lat: 51.1079, lon: 17.0385 },
        Poznań: { lat: 52.4064, lon: 16.9252 },
        Gdańsk: { lat: 54.352, lon: 18.6466 },
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
        { key: 'car-service', pl: 'Serwis samochodowy', uk: 'Автосервіс', en: 'Car Service', ru: 'Автосервис' },
        { key: 'oil-change', pl: 'Wymiana oleju', uk: 'Заміна масла', en: 'Oil Change', ru: 'Замена масла' },
        { key: 'brakes', pl: 'Hamulce', uk: 'Гальма', en: 'Brakes', ru: 'Тормоза' },
        { key: 'diagnostics', pl: 'Diagnostyka', uk: 'Діагностика', en: 'Diagnostics', ru: 'Диагностика' },
        { key: 'fast-repair', pl: 'Szybka naprawa', uk: 'Швидкий ремонт', en: 'Fast Repair', ru: 'Быстрый ремонт' },
        { key: 'engine', pl: 'Silnik', uk: 'Двигун', en: 'Engine', ru: 'Двигатель' },
        { key: 'suspension', pl: 'Zawieszenie', uk: 'Підвіска', en: 'Suspension', ru: 'Подвеска' },
        { key: 'ac', pl: 'Klimatyzacja', uk: 'Кондиціонер', en: 'Air Conditioning', ru: 'Кондиционер' },
        { key: 'sto', pl: 'STO', uk: 'СТО', en: 'STO', ru: 'СТО' },
        { key: 'car-repair', pl: 'Naprawa samochodów', uk: 'Ремонт авто', en: 'Car Repair', ru: 'Ремонт авто' },
        { key: 'quick-repair', pl: 'Szybki serwis', uk: 'Швидкий сервіс', en: 'Quick Repair', ru: 'Быстрый сервис' },
        { key: 'ac-service', pl: 'Serwis klimatyzacji', uk: 'Сервіс кондиціонерів', en: 'AC Service', ru: 'Сервис кондиционеров' },
        { key: 'timing-belt', pl: 'Rozrząd', uk: 'ГРМ', en: 'Timing Belt', ru: 'ГРМ' },
        { key: 'oil-service', pl: 'Serwis olejowy', uk: 'Заміна масла', en: 'Oil Service', ru: 'Замена масла' },
        { key: 'inspection', pl: 'Przegląd', uk: 'Техогляд', en: 'Inspection', ru: 'Техосмотр' },
        { key: 'tires', pl: 'Opony', uk: 'Шини', en: 'Tires', ru: 'Шины' },
        { key: 'alignment', pl: 'Geometria kół', uk: 'Розвал-сходження', en: 'Wheel Alignment', ru: 'Развал-схождение' },
        { key: 'pro-service', pl: 'Profesjonalny serwis', uk: 'Професійний сервіс', en: 'Pro Service', ru: 'Профессиональный сервис' },
        { key: 'engine-repair', pl: 'Naprawa silnika', uk: 'Ремонт двигуна', en: 'Engine Repair', ru: 'Ремонт двигателя' },
        { key: 'clutch', pl: 'Sprzęgło', uk: 'Зчеплення', en: 'Clutch', ru: 'Сцепление' },
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
        plName?: string, ukName?: string, enName?: string, ruName?: string,
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
            { serviceId: service.id, languageCode: 'pl', name: data.plName ?? data.name, description: data.plDesc },
            { serviceId: service.id, languageCode: 'uk', name: data.ukName ?? data.name, description: data.ukDesc },
            { serviceId: service.id, languageCode: 'en', name: data.enName ?? data.name, description: data.enDesc },
            { serviceId: service.id, languageCode: 'ru', name: data.ruName ?? data.name, description: data.ruDesc },
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
        console.log(`Added ${data.name} (${data.slug}) with ${data.locations.length} locations.`);
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
        locations: [{ city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.233, longitude: 21.0176, email: 'pianavyshnia.info@fest.foundation', isMainLocation: true, openingHours: standardGastroHours }]
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
        ukName: 'Ресторан У сестер', enName: 'Restaurant U Sióstr', ruName: 'Ресторан У сестёр',
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
        ukName: 'Кресові смаки Валентини', enName: 'Kresowe Smaki Valentyny', ruName: 'Кресовые вкусы Валентины',
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
        ukName: 'Каманда Львівська', enName: 'Kamanda Lwowska', ruName: 'Каманда Львовская',
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
        ukName: 'Бістро Козацька Хатка', enName: 'Bistro Kozacka Chatka', ruName: 'Бистро Козацкая Хатка',
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
        ukName: 'Смак Український', enName: 'Ukrainian Flavor', ruName: 'Украинский вкус',
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
        ukName: 'Ресторан Думка', enName: 'Restaurant Dumka', ruName: 'Ресторан Думка',
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
        ukName: 'Кулінарна Україна', enName: 'Culinary Ukraine', ruName: 'Кулинарная Украина',
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
        ukName: 'Вілла Біла', enName: 'White Villa', ruName: 'Вилла Белая',
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
        ukName: 'Сервіс UA', enName: 'Service UA', ruName: 'Сервис UA',
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
        ukName: 'Фундація Оцаленє', enName: 'Ocalenie Foundation', ruName: 'Фонд Оцаление',
        plDesc: 'Bezpłatna pomoc prawna, psychologiczna i kursy języka polskiego dla uchodźców i migrantów.',
        ukDesc: 'Безкоштовна юридична, психологічна допомога та курси польської мови для біженців та мігрантів.',
        enDesc: 'Free legal, psychological assistance and Polish language courses for refugees and migrants.',
        ruDesc: 'Бесплатная юридическая, психологическая помощь и курсы польского языка для беженцев и мигрантов.',
        tags: ['legal', 'culture', 'health'],
        image: 'fundacja-ocalenie.png',
        webpage: 'https://ocalenie.org.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Krucza 6/14a', voivodeship: 'mazowieckie', latitude: 52.2315, longitude: 21.0185, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 22 828 04 50', email: 'cpc@cpc.org.pl' },
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
            { city: 'Łódź', street: 'ul. Armii Krajowej 29', voivodeship: 'lodzkie', latitude: 51.7455, longitude: 19.4135, openingHours: standardShopHours },
            { city: 'Częstochowa', street: 'ul. Jagiellońska 1', voivodeship: 'slaskie', latitude: 50.8125, longitude: 19.1185, openingHours: standardShopHours },
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
        image: 'lingua-city.png',
        webpage: 'https://www.lingua-city.com/',
        socials: { facebook: 'https://www.facebook.com/LinguaCity/', youtube: 'https://www.youtube.com/channel/UCwgPi8cERkNobR9f0a8wfGw' },
        locations: [
            { city: 'Katowice', street: 'ul. Mickiewicza 15', voivodeship: 'slaskie', latitude: 50.2595, longitude: 19.0182, openingHours: standardShopHours, phoneNumber: '+48 696 434 142', email: 'biuro@lingua-city.com' }
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
        ukName: 'Твій лікар у Варшаві', enName: 'Your Doctor in Warsaw', ruName: 'Твой врач в Варшаве',
        plDesc: 'Prywatna przychodnia medyczna założona z myślą o pacjentach ukraińskojęzycznych. Kompleksowa opieka: od internisty po ginekologa.',
        ukDesc: 'Приватна медична клініка, створена для україномовних пацієнтів. Комплексна допомога: від терапевta до гінеколога.',
        enDesc: 'Private medical clinic designed for Ukrainian-speaking patients. Comprehensive care: from general practitioner to gynecologist.',
        ruDesc: 'Частная медицинская клиника, созданная для украиноязычных пациентов. Комплексная помощь: от терапевта до гинеколога.',
        tags: ['health', 'doctor', 'pediatrician'],
        webpage: 'https://twojlekarz-wawa.pl/',
        image: 'twoj-lekarz-w-warszawie.png',
        socials: { instagram: 'https://www.instagram.com/doctor.wawa/', facebook: 'https://www.facebook.com/doctor.warszawa/', viber: 'viber://chat?number=+48789809717', telegram: 'https://t.me/Twojlekarz', whatsapp: 'https://wa.me/48600232284' },
        locations: [
            { city: 'Warszawa', street: 'ul. Płosa 3', voivodeship: 'mazowieckie', latitude: 52.276, longitude: 21.054, openingHours: twojLekarzHours, isMainLocation: true, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Warszawa', street: 'ul. Arabska 5', voivodeship: 'mazowieckie', latitude: 52.226, longitude: 21.083, openingHours: twojLekarzHours, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Warszawa', street: 'ul. Batalionu AK "Parasol" 5/7', voivodeship: 'mazowieckie', latitude: 52.231, longitude: 20.951, openingHours: twojLekarzHours, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' },
            { city: 'Warszawa', street: 'ul. Czerniakowska 139', voivodeship: 'mazowieckie', latitude: 52.209, longitude: 21.053, openingHours: twojLekarzMokotowHours, phoneNumber: '+48 500 863 535', email: 'sekretariat@twojlekarz-wawa.pl' }
        ]
    });

    // Twój Lekarz w Poznaniu (Przychodnia ukraińska)
    await seedService({
        name: 'Twój Lekarz w Poznaniu',
        slug: 'twoj-lekarz-poznan',
        category: 'health',
        ukName: 'Твій лікар у Познані', enName: 'Your Doctor in Poznań', ruName: 'Твой врач в Познани',
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
        ukName: 'Твій лікар у Кракові', enName: 'Your Doctor in Kraków', ruName: 'Твой врач в Кракове',
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
        ukName: 'Твій лікар у Тримісті', enName: 'Your Doctor in Tricity', ruName: 'Твой врач в Труймясто',
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
        ukName: 'Твій лікар у Вроцлаві', enName: 'Your Doctor in Wrocław', ruName: 'Твой врач во Вроцлаве',
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
        ukName: 'Progress Holding - Бухгалтерія та Фінанси', enName: 'Progress Holding - Accounting & Finance', ruName: 'Progress Holding - Бухгалтерия и Финансы',
        plDesc: 'Biuro rachunkowe specjalizujące się w obsłudze ukraińskiego biznesu w Polsce. Doradztwo podatkowe, optymalizacja i zakładanie spółek.',
        ukDesc: 'Бухгалтерія, що спеціалізується на обслуговуванні українського бізнесу в Польщі. Податкові консультації, оптимізація та реєстрація компаній.',
        enDesc: 'Accounting office specializing in serving Ukrainian businesses in Poland. Tax consulting, optimization and company registration.',
        ruDesc: 'Бухгалтерия, специализирующаяся на обслуживании украинского бизнеса в Польше. Налоговые консультации, оптимизация и регистрация компаний.',
        tags: ['legal', 'documents'],
        image: 'progress-holding-ksiegowosc-i-finanse.png',
        webpage: 'https://progressholding.pl/',
        socials: { facebook: 'https://www.facebook.com/progressholding/' },
        locations: [
            { city: 'Warszawa', street: 'ul. Szańcowa 44', voivodeship: 'mazowieckie', latitude: 52.2295, longitude: 21.0115, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 603 232 418', email: 'office@progressholding.pl' }
        ]
    });

    await seedService({
        name: 'Ukraińsko-Polska Izba Gospodarcza',
        slug: 'upig-biznes',
        category: 'financial',
        ukName: 'Українсько-Польська Господарча Палата', enName: 'Ukrainian-Polish Chamber of Commerce', ruName: 'Украинско-Польская Торговая Палата',
        plDesc: 'Organizacja wspierająca współpracę gospodarczą. Doradztwo w zakresie inwestycji, pozyskiwania finansowania i networkingu biznesowego.',
        ukDesc: 'Організація, що підтримує економічну співпрацю. Консультування з питань інвестицій, залучення фінансування та ділового нетворкінгу.',
        enDesc: 'Organization supporting economic cooperation. Consulting on investments, fundraising and business networking.',
        ruDesc: 'Организация, поддерживающая экономическое сотрудничество. Консультирование по вопросам инвестиций, привлечения финансирования и делового нетворкинга.',
        tags: ['ngo', 'legal', 'modern'],
        image: 'ukrainsko-polska-izba-gospodarcza.png',
        webpage: 'https://pol-ukr.com/',
        locations: [
            { city: 'Warszawa', street: 'ul. Szpitalna 5', voivodeship: 'mazowieckie', latitude: 52.2345, longitude: 21.0145, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+380 50 410 59 26', email: 'kyiv@pol-ukr.com' }
        ]
    });

    await seedService({
        name: 'Teatr Navpaky',
        slug: 'teatr-navpaky',
        category: 'help_support',
        ukName: 'Театр Навпаки', enName: 'Navpaky Theatre', ruName: 'Театр Навпаки',
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
        name: 'Traple Konarski Podrecki',
        slug: 'ukrainian-desk-tkp',
        category: 'law',
        socials: { facebook: 'https://www.facebook.com/TKPAcademy', linkedin: 'https://www.linkedin.com/company/traple-konarski-podrecki-&-partners/mycompany/?viewAsMember=true', youtube: 'https://www.youtube.com/channel/UCOdX4sZpML9JX2zhCSfcmcg', instagram: 'https://www.instagram.com/safebrandfirst/' },
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
        ukName: 'Адвокатська канцелярія адвокат Оксана П\'ятковська', enName: 'Law Office of Attorney Oxana Piątkowska', ruName: 'Адвокатская канцелярия адвокат Оксана Пятковская',
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
        ukName: 'Східна канцелярія – Адвокат Ольга Дугіль', enName: 'Eastern Law Office – Attorney Olga Dugil', ruName: 'Восточная канцелярия – Адвокат Ольга Дугиль',
        plDesc: 'Kancelaria specjalizująca się w prawie wschodnioeuropejskim (Ukraina, Rosja, Białoruś, Kazachstan) z 20-letnim doświadczeniem. Rejestracja firm, legalizacja pracowników, obsługa celna, reprezentacja przed sądami i urzędami.',
        ukDesc: 'Юридична фірма, що спеціалізується на східноєвропейському праві (Україна, Росія, Білорусь, Казахстан) з 20-річним досвідом. Реєстрація компаній, легалізація працівників, митне оформлення, представництво в судах та органах влади.',
        enDesc: 'Law firm specializing in Eastern European law (Ukraine, Russia, Belarus, Kazakhstan) with 20 years of experience. Company registration, employee legalization, customs handling, representation in courts and offices.',
        ruDesc: 'Юридическая фирма, специализирующаяся на восточноевропейском праве (Украина, Россия, Беларусь, Казахстан) с 20-летним опытом. Регистрация компаний, легализация работников, таможенное оформление, представительство в судах и органах власти.',
        webpage: 'https://dugilolga.pl/pl',
        image: 'kancelaria-wschodnia-adwokat-olga-dugil.png',
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
        ukName: 'Канцелярія юрисконсульта Пьотр Камлер', enName: 'Legal Counsel Office Piotr Kamler', ruName: 'Канцелярия юрисконсульта Пётр Камлер',
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
                latitude: 51.11,
                longitude: 16.993,
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
                latitude: 54.402_948,
                longitude: 18.571_977,
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
                longitude: 19.361_944,
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
        image: 'bial-mich.png',
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
        socials: { facebook: 'https://www.facebook.com/manieranailbar/' },
        image: 'maniera-face-bar-nail.png',
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
        image: 'weronailka.png',
        webpage: 'https://booksy.com/pl-pl/250481_weronailka_paznokcie_3_warszawa',
        socials: { instagram: 'https://www.instagram.com/weronailka/' },
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
        webpage: 'https://booksy.com/pl-pl/243436_manicure-pedicure_paznokcie_8820_krakow',
        socials: { instagram: 'https://www.instagram.com/nastia_manicure.krakow/', facebook: 'https://www.facebook.com/profile.php?id=100080597851371' },
        image: 'manicure-and-pedicure.png',
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

    const wroclawLat = 51.1079;
    const wroclawLon = 17.0385;

// 12) Alina Nails Art
    await seedService({
        name: 'Alina Nails Art',
        slug: 'alina-nails-art',
        category: 'beauty',
        plDesc: 'Studio paznokci (manicure/pedicure) dostępne do rezerwacji na Booksy.',
        ukDesc: 'Студія нігтів (манікюр/педикюр), доступна для запису в Booksy.',
        enDesc: 'Nail studio (manicure/pedicure) bookable on Booksy.',
        ruDesc: 'Студия ногтей (маникюр/педикюр), доступна для записи в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://booksy.com/pl-pl/259300_alina-nails-art_paznokcie_13750_wroclaw',
        socials: { instagram: 'https://www.instagram.com/alina_nails_art/' },
        image: 'alina-nails-art.png',
        locations: [
            {
                city: 'Wrocław',
                street: 'plac Legionów 14',
                voivodeship: 'dolnoslaskie',
                latitude: wroclawLat,
                longitude: wroclawLon,
                openingHours: standardShopHours,
            },
        ],
    });

// 13) Alinails.wro
    await seedService({
        name: 'Alinails.wro',
        slug: 'alinails-wro',
        category: 'beauty',
        plDesc: 'Studio paznokci dostępne do rezerwacji na Booksy.',
        ukDesc: 'Студія нігтів, доступна для запису в Booksy.',
        enDesc: 'Nail studio bookable on Booksy.',
        ruDesc: 'Студия ногтей, доступна для записи в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://booksy.com/pl-pl/299076_alinails-wro_paznokcie_13750_wroclaw',
        socials: { instagram: 'https://www.instagram.com/alinails.wro/' },
        image: 'alinailswro.png',
        locations: [
            {
                city: 'Wrocław',
                street: 'Nowowiejska 45, 1B (lokal po lewej stronie od bramy 45)',
                voivodeship: 'dolnoslaskie',
                latitude: wroclawLat,
                longitude: wroclawLon,
                openingHours: standardShopHours,
            },
        ],
    });

// 14) LUMES Beauty Studio
    await seedService({
        name: 'LUMES Beauty Studio',
        slug: 'lumes-beauty-studio',
        category: 'beauty',
        plDesc: 'Studio paznokci dostępne do rezerwacji na Booksy.',
        ukDesc: 'Студія нігтів, доступна для запису в Booksy.',
        enDesc: 'Nail studio bookable on Booksy.',
        ruDesc: 'Студия ногтей, доступна для записи в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://booksy.com/pl-pl/333100_lumes-beauty-studio_paznokcie_13750_wroclaw',
        socials: { instagram: 'https://www.instagram.com/Lumespoland/' },
        image: 'lumes.png',
        locations: [
            {
                city: 'Wrocław',
                street: 'Sterowcowa 14',
                voivodeship: 'dolnoslaskie',
                latitude: wroclawLat,
                longitude: wroclawLon,
                openingHours: standardShopHours,
            },
        ],
    });

// 15) Adore Nail Studio
    await seedService({
        name: 'Adore Nail Studio',
        slug: 'adore-nail-studio',
        category: 'beauty',
        plDesc: 'Studio paznokci (manicure/pedicure) dostępne do rezerwacji na Booksy.',
        ukDesc: 'Студія нігтів (манікюр/педикюр), доступна для запису в Booksy.',
        enDesc: 'Nail studio (manicure/pedicure) bookable on Booksy.',
        ruDesc: 'Студия ногтей (маникюр/педикюр), доступна для записи в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://booksy.com/pl-pl/137081_adore-nail-studio_paznokcie_13750_wroclaw',
        socials: { instagram: 'https://www.instagram.com/adorepoland/', facebook: 'https://www.facebook.com/adorepoland/' },
        image: 'adore-nail-studio.png',
        locations: [
            {
                city: 'Wrocław',
                street: 'Legnicka 59D',
                voivodeship: 'dolnoslaskie',
                latitude: wroclawLat,
                longitude: wroclawLon,
                openingHours: standardShopHours,
            },
        ],
    });

// 16) MVK
    await seedService({
        name: 'MVK',
        slug: 'mvk',
        category: 'beauty',
        plDesc: 'Studio paznokci dostępne do rezerwacji na Booksy.',
        ukDesc: 'Студія нігтів, доступна для запису в Booksy.',
        enDesc: 'Nail studio bookable on Booksy.',
        ruDesc: 'Студия ногтей, доступна для записи в Booksy.',
        tags: ['beauty', 'nails'],
        webpage: 'https://mvk.ua/ua',
        socials: { instagram: 'https://www.instagram.com/mvk.wroclaw/', facebook: 'https://www.facebook.com/people/MVK-Wroclaw/61565011881081/' },
        image: 'mvk.png',
        locations: [
            {
                city: 'Wrocław',
                street: 'Generała Romualda Traugutta 9/19',
                voivodeship: 'dolnoslaskie',
                latitude: wroclawLat,
                longitude: wroclawLon,
                openingHours: standardShopHours,
            },
        ],
    });

    // 1. EASY Warsztat Samochodowy (Warszawa)
    await seedService({
        name: 'EASY Warsztat Samochodowy | Автосервис',
        slug: 'easy-warsztat-samochodowy-warszawa',
        category: 'mechanics',
        ukName: 'EASY Автомайстерня | Автосервіс', enName: 'EASY Car Workshop', ruName: 'EASY Автомастерская | Автосервис',
        plDesc: 'Profesjonalny warsztat samochodowy oferujący kompleksową mechanikę pojazdową, serwis eksploatacyjny oraz diagnostykę komputerową. Obsługa w języku polskim i ukraińskim.',
        ukDesc: 'Професійний автосервіс, що пропонує комплексний ремонт автомобілів, технічне обслуговування та комп’ютерну діагностику. Обслуговування польською та українською мовами.',
        enDesc: 'Professional car workshop offering comprehensive vehicle mechanics, maintenance service, and computer diagnostics. Service available in Polish and Ukrainian.',
        ruDesc: 'Профессиональный автосервис, предлагающий комплексный ремонт автомобилей, техническое обслуживание и компьютерную диагностику. Обслуживание на польском и украинском языках.',
        webpage: 'https://www.facebook.com/easywarsztat/',
        image: 'easy-warsztat-samochodowy-or-avtoservis.png',
        tags: ['mechanic', 'repair', 'car-service'],
        locations: [
            {
                city: 'Warszawa',
                street: 'ul. Stanisława Bodycha 39',
                voivodeship: 'mazowieckie',
                latitude: 52.191_244,
                longitude: 20.879_556,
                phoneNumber: '+48 797 967 777',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '09:00', close: '18:00' },
                    tuesday: { open: '09:00', close: '18:00' },
                    wednesday: { open: '09:00', close: '18:00' },
                    thursday: { open: '09:00', close: '18:00' },
                    friday: { open: '09:00', close: '18:00' },
                    saturday: { open: '09:00', close: '14:00' },
                },
            },
        ],
    });

// 2. Auto Service Auto Dyskusja (Kraków)
    await seedService({
        name: 'Auto Service Auto Dyskusja',
        slug: 'auto-service-auto-dyskusja-krakow',
        category: 'mechanics',
        plDesc: 'Serwis samochodowy specjalizujący się w naprawach bieżących, serwisie olejowym oraz układach hamulcowych. Przyjazna atmosfera i transparentne koszty naprawy.',
        ukDesc: 'Автосервіс, що спеціалізується на поточному ремонті, заміні масла та гальмівних системах. Дружня атмосфера та прозорі ціни на ремонт.',
        enDesc: 'Car service specializing in routine repairs, oil changes, and braking systems. Friendly atmosphere and transparent repair costs.',
        ruDesc: 'Автосервис, специализирующийся на текущем ремонте, замене масла и тормозных системах. Дружелюбная атмосфера и прозрачная стоимость ремонта.',
        webpage: 'https://www.autodyskusja.pl/',
        image: 'auto-service-auto-dyskusja.png',
        tags: ['mechanic', 'oil-change', 'brakes'],
        locations: [
            {
                city: 'Kraków',
                street: 'ul. Michała Korpala 3',
                voivodeship: 'malopolskie',
                latitude: 50.015_622,
                longitude: 19.893_822,
                phoneNumber: '+48 786 212 776',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '08:00', close: '17:00' },
                    tuesday: { open: '08:00', close: '17:00' },
                    wednesday: { open: '08:00', close: '17:00' },
                    thursday: { open: '08:00', close: '17:00' },
                    friday: { open: '08:00', close: '17:00' },
                },
            },
        ],
    });

// 3. R-MAX Auto (Wrocław)
    await seedService({
        name: 'R-MAX Auto Wrocław',
        slug: 'r-max-auto-wroclaw',
        category: 'mechanics',
        plDesc: 'Nowoczesny warsztat oferujący szeroki zakres usług mechanicznych. Specjalizacja w diagnostyce i szybkich naprawach serwisowych. Komunikacja w języku ukraińskim.',
        ukDesc: 'Сучасна майстерня, що пропонує широкий спектр механічних послуг. Спеціалізація на діагностиці та швидкому сервісному ремонті. Спілкування українською мовою.',
        enDesc: 'Modern workshop offering a wide range of mechanical services. Specializing in diagnostics and quick service repairs. Communication in Ukrainian.',
        ruDesc: 'Современная мастерская, предлагающая широкий спектр механических услуг. Специализация на диагностике и быстром сервисном ремонте. Общение на украинском языке.',
        webpage: 'https://dobrymechanik.pl/mechanicy/wroclaw/r-max-auto.html',
        image: 'r-max-auto-wroclaw.png',
        tags: ['mechanic', 'diagnostics', 'fast-repair'],
        locations: [
            {
                city: 'Wrocław',
                street: 'ul. Paprotna 8',
                voivodeship: 'dolnoslaskie',
                latitude: 51.144_444,
                longitude: 17.025_556,
                phoneNumber: '+48 886 494 643',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '08:30', close: '17:30' },
                    tuesday: { open: '08:30', close: '17:30' },
                    wednesday: { open: '08:30', close: '17:30' },
                    thursday: { open: '08:30', close: '17:30' },
                    friday: { open: '08:30', close: '17:30' },
                },
            },
        ],
    });

// 4. Serwis Group UA PL (Poznań)
    await seedService({
        name: 'Serwis Group UA PL Poznań',
        slug: 'serwis-group-ua-pl-poznan',
        category: 'mechanics',
        ukName: 'Сервіс Груп UA PL Познань', enName: 'Service Group UA PL Poznań', ruName: 'Сервис Груп UA PL Познань',
        plDesc: 'Polsko-ukraiński zespół mechaników zapewniający rzetelne naprawy silników, zawieszenia oraz serwis klimatyzacji. Szybkie terminy i fachowe doradztwo.',
        ukDesc: 'Польсько-українська команда механіків, що забезпечує надійний ремонт двигунів, підвіски та обслуговування кондиціонерів. Швидкі терміни та професійні поради.',
        enDesc: 'Polish-Ukrainian team of mechanics providing reliable engine repairs, suspension work, and AC service. Fast turnaround and professional advice.',
        ruDesc: 'Польско-украинская команда механиков, обеспечивающая надежный ремонт двигателей, подвески и обслуживание кондиционеров. Быстрые сроки и профессиональные консультации.',
        webpage: 'https://dobrymechanik.pl/mechanicy/poznan/auto-serwis-group-ua-pl.html',
        socials: {facebook: 'https://www.facebook.com/SerwisGroup/'},
        image: 'serwis-group-ua-pl-poznan.png',
        tags: ['mechanic', 'engine', 'suspension', 'ac'],
        locations: [
            {
                city: 'Poznań',
                street: 'ul. Morasko 5',
                voivodeship: 'wielkopolskie',
                latitude: 52.478_901,
                longitude: 16.923_456,
                phoneNumber: '+48 573 294 010',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '09:00', close: '18:00' },
                    tuesday: { open: '09:00', close: '18:00' },
                    wednesday: { open: '09:00', close: '18:00' },
                    thursday: { open: '09:00', close: '18:00' },
                    friday: { open: '09:00', close: '18:00' },
                    saturday: { open: '09:00', close: '14:00' },
                },
            },
        ],
    });


    // 5. Kraków warsztat samochodowy | СТО Краков
    await seedService({
        name: 'Kraków warsztat samochodowy | СТО Краков',
        slug: 'krakow-warsztat-samochodowy-sto',
        category: 'mechanics',
        ukName: 'Краків автомайстерня | СТО Краків', enName: 'Kraków Car Workshop | STO', ruName: 'Краков автомастерская | СТО Краков',
        plDesc: 'Profesjonalny serwis samochodowy (STO) w Krakowie, oferujący pełen zakres napraw mechanicznych, serwis olejowy oraz przeglądy okresowe. Obsługa prowadzona przez doświadczonych mechaników.',
        ukDesc: 'Професійний автосервіс (СТО) у Кракові, що пропонує повний спектр механічного ремонту, заміну масла та періодичні огляди. Обслуговування проводять досвідчені механіки.',
        enDesc: 'Professional car service (STO) in Krakow, offering a full range of mechanical repairs, oil service, and periodic inspections. Service provided by experienced mechanics.',
        ruDesc: 'Профессиональный автосервис (СТО) в Кракове, предлагающий полный спектр механического ремонта, замену масла и периодические осмотры. Обслуживание проводят опытные механики.',
        webpage: 'https://frontauto.pl/',
        image: 'krakow-warsztat-samochodowy-or-sto-krakov.png',
        tags: ['mechanic', 'sto', 'car-repair'],
        socials: { instagram: 'https://www.instagram.com/sto_krakow/' },
        locations: [
            {
                city: 'Kraków',
                street: 'ul. Na Zakolu Wisły 14',
                voivodeship: 'malopolskie',
                latitude: 50.046_522,
                longitude: 19.967_822,
                phoneNumber: '+48 452 896 921',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '08:00', close: '18:00' },
                    tuesday: { open: '08:00', close: '18:00' },
                    wednesday: { open: '08:00', close: '18:00' },
                    thursday: { open: '08:00', close: '18:00' },
                    friday: { open: '08:00', close: '18:00' },
                    saturday: { open: '09:00', close: '15:00' },
                },
            },
        ],
    });


// 2. AUTOSERWIS UKR (Długosza)
    await seedService({
        name: 'Turbo Baza',
        slug: 'turbo-baza-krapkowice',
        category: 'mechanics',
        plDesc: 'Uznany serwis samochodowy z ukraińską kadrą specjalistów. Kompleksowa naprawa aut osobowych i dostawczych. Specjalizacja: układy hamulcowe i kierownicze.',
        ukDesc: 'Визнаний автосервіс з українським штатом спеціалістів. Комплексний ремонт легкових та вантажних автомобілів. Спеціалізація: гальмівні та рульові системи.',
        enDesc: 'Recognized car service with Ukrainian specialist staff. Comprehensive repair of passenger cars and vans. Specialization: brake and steering systems.',
        ruDesc: 'Признанный автосервис с украинским штатом специалистов. Комплексный ремонт легковых и грузовых автомобилей. Специализация: тормозные и рулевые системы.',
        webpage: 'https://www.facebook.com/turbobaza/',
        image: 'turbo-baza.png',
        tags: ['mechanic', 'car-repair', 'brakes'],
        locations: [
            {
                city: 'Krapkowice',
                street: 'ul. Kani 19',
                voivodeship: 'opolskie',
                latitude: 50.4888703,
                longitude: 17.97901,
                email: 'alex6691@gmail.com',
                phoneNumber: '+48 661 478 306',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '08:00', close: '18:00' },
                    tuesday: { open: '08:00', close: '18:00' },
                    wednesday: { open: '08:00', close: '18:00' },
                    thursday: { open: '08:00', close: '18:00' },
                    friday: { open: '08:00', close: '18:00' },
                    saturday: { open: '09:00', close: '14:00' },
                },
            },
        ],
    });

    // J.U Transport VIP Service – VIP transport pasażerski, Rzeszów
    await seedService({
        name: 'J.U Transport VIP Service',
        slug: 'ju-transport-vip',
        category: 'transport',
        plDesc: 'Profesjonalny transport VIP z Rzeszowa. Prywatne przewozy osób ekskluzywną flotą (m.in. Mercedes V-Class) na terenie Polski, UE i Ukrainy. Transfery lotniskowe, dworcowe i hotelowe 24/7 z gwarancją dyskrecji i bezpieczeństwa.',
        ukDesc: 'Професійний VIP-транспорт із Жешува. Приватні пасажирські перевезення ексклюзивним автопарком (зокрема Mercedes V-Class) по Польщі, ЄС та Україні. Трансфери до аеропортів, вокзалів та готелів 24/7 з гарантією конфіденційності та безпеки.',
        enDesc: 'Professional VIP transport from Rzeszów. Private passenger rides in an exclusive fleet (including Mercedes V-Class) across Poland, the EU, and Ukraine. Airport, station, and hotel transfers 24/7 with guaranteed discretion and safety.',
        ruDesc: 'Профессиональный VIP-транспорт из Жешува. Частные пассажирские перевозки эксклюзивным автопарком (включая Mercedes V-Class) по Польше, ЕС и Украине. Трансферы в аэропорты, на вокзалы и в отели 24/7 с гарантией конфиденциальности и безопасности.',
        webpage: 'https://ju-transport-vip.com/',
        image: 'ju-transport-vip-service.png',
        tags: ['poland-ukraine', 'international'],
        socials: { facebook: 'https://www.facebook.com/people/JU-Transport-VIP-Service/61573495686434/' },
        languages: ['pl', 'uk', 'en'],
        locations: [
            {
                city: 'Rzeszów',
                street: 'Rzeszów',
                voivodeship: 'podkarpackie',
                latitude: 50.0412,
                longitude: 21.9991,
                phoneNumber: '+48 729 915 263',
                email: 'kontakt@ju-transport-vip.com',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '00:00', close: '23:59' },
                    tuesday: { open: '00:00', close: '23:59' },
                    wednesday: { open: '00:00', close: '23:59' },
                    thursday: { open: '00:00', close: '23:59' },
                    friday: { open: '00:00', close: '23:59' },
                    saturday: { open: '00:00', close: '23:59' },
                    sunday: { open: '00:00', close: '23:59' },
                },
            },
        ],
    });

    // FoxTrans – przewozy autokarowe Ukraina ↔ Polska
    await seedService({
        name: 'FoxTrans',
        slug: 'foxtrans',
        category: 'transport',
        plDesc: 'Międzynarodowy przewoźnik autokarowy na trasie Ukraina ↔ Polska. Oferuje regularne połączenia autokarowe, wynajem autokarów na wycieczki turystyczne i szkolne oraz profesjonalny transport pasażerski.',
        ukDesc: 'Міжнародний автобусний перевізник на маршруті Україна ↔ Польща. Пропонує регулярні автобусні рейси, оренду автобусів для туристичних та шкільних поїздок, а також професійні пасажирські перевезення.',
        enDesc: 'International coach carrier on the Ukraine ↔ Poland route. Offers regular coach connections, coach rental for tourist and school trips, and professional passenger transport.',
        ruDesc: 'Международный автобусный перевозчик на маршруте Украина ↔ Польша. Предлагает регулярные автобусные рейсы, аренду автобусов для туристических и школьных поездок, а также профессиональные пассажирские перевозки.',
        webpage: 'https://www.foxtrans.pl/',
        image: 'foxtrans.png',
        tags: ['poland-ukraine', 'international'],
        socials: { facebook: 'https://www.facebook.com/foxtranspotration/' },
        nip: '6472582490',
        locations: [
            {
                city: 'Radlin',
                street: 'ul. Józefa Rymera 119',
                voivodeship: 'slaskie',
                latitude: 50.049,
                longitude: 18.471,
                phoneNumber: '+48 570 50 10 10',
                email: 'kontakt@foxtrans.pl',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '07:00', close: '16:00' },
                    tuesday: { open: '07:00', close: '16:00' },
                    wednesday: { open: '07:00', close: '16:00' },
                    thursday: { open: '07:00', close: '16:00' },
                    friday: { open: '07:00', close: '16:00' },
                },
            },
        ],
    });

    // Busikom – przewozy pasażerskie Ukraina ↔ Europa
    await seedService({
        name: 'Busikom',
        slug: 'busikom',
        category: 'transport',
        plDesc: 'Międzynarodowy przewoźnik autobusowy specjalizujący się w połączeniach Ukraina ↔ Europa. Oferuje komfortowe przejazdy busem i minibusem, przesyłki paczek z Ukrainy do Polski oraz indywidualne zlecenia transportowe.',
        ukDesc: 'Міжнародний автобусний перевізник, що спеціалізується на маршрутах Україна ↔ Європа. Пропонує комфортні автобусні та мікроавтобусні поїздки, доставку посилок з України до Польщі та індивідуальні транспортні замовлення.',
        enDesc: 'International bus carrier specializing in Ukraine ↔ Europe routes. Offers comfortable bus and minivan rides, package delivery from Ukraine to Poland, and individual transport contracts.',
        ruDesc: 'Международный автобусный перевозчик, специализирующийся на маршрутах Украина ↔ Европа. Предлагает комфортные автобусные и микроавтобусные поездки, доставку посылок из Украины в Польшу и индивидуальные транспортные заказы.',
        webpage: 'https://busikom.com/pl/',
        image: 'busikom.png',
        tags: ['delivery', 'poland-ukraine', 'international'],
        socials: { instagram: 'https://www.instagram.com/busikom_com/', facebook: 'https://www.facebook.com/busikomcom' },
        locations: [
            {
                city: 'Warszawa',
                street: 'Warszawa',
                voivodeship: 'mazowieckie',
                latitude: 52.2297,
                longitude: 21.0122,
                phoneNumber: '+48 222 66 27 17',
                isMainLocation: true,
                openingHours: {
                    monday: { open: '08:00', close: '20:00' },
                    tuesday: { open: '08:00', close: '20:00' },
                    wednesday: { open: '08:00', close: '20:00' },
                    thursday: { open: '08:00', close: '20:00' },
                    friday: { open: '08:00', close: '20:00' },
                    saturday: { open: '08:00', close: '20:00' },
                    sunday: { open: '08:00', close: '20:00' },
                },
            },
        ],
    });

    // --- 1. DODAJ NOWE TAGI DO tagsToCreate ---
    const realEstateAgencyTags = [
        { key: 'real-estate-agency', pl: 'Biuro nieruchomości', uk: 'Агентство нерухомості', en: 'Real estate agency', ru: 'Агентство недвижимости' },
        { key: 'ua-speaking', pl: 'Obsługa po ukraińsku', uk: 'Обслуговування українською', en: 'Ukrainian speaking service', ru: 'Обслуживание на украинском' },
        { key: 'relocation', pl: 'Relokacja', uk: 'Релокація', en: 'Relocation', ru: 'Релокация' },
        { key: 'verified-offers', pl: 'Sprawdzone oferty', uk: 'Перевірені пропозиції', en: 'Verified offers', ru: 'Проверенные предложения' },
    ];

    for (const t of realEstateAgencyTags) {
        const [tag] = await db.insert(tagsTable).values({}).returning();
        await db.insert(tagsTranslationsTable).values([
            { tagId: tag.id, languageCode: 'pl', name: t.pl },
            { tagId: tag.id, languageCode: 'uk', name: t.uk },
            { tagId: tag.id, languageCode: 'en', name: t.en },
            { tagId: tag.id, languageCode: 'ru', name: t.ru },
        ]);
        tagMap[t.key] = tag.id;
    }

// --- 2. DODAJ USŁUGI (SERVICES) ---

// 1. Hamilton May
    await seedService({
        name: 'Hamilton May',
        slug: 'hamilton-may',
        category: 'real_estate',
        plDesc: 'Wiodące biuro nieruchomości specjalizujące się w najmie długoterminowym dla obcokrajowców. Posiadają wielojęzyczny zespół i pomagają w bezpiecznym procesie najmu okazjonalnego.',
        ukDesc: 'Провідне агентство нерухомості, що спеціалізується на довгостроковій оренді для іноземців. Мають багатомовну команду та допомагають у безпечному процесі оренди.',
        enDesc: 'Leading real estate agency specializing in long-term rentals for foreigners. They have a multilingual team and assist in a secure rental process.',
        ruDesc: 'Ведущее агентство недвижимости, специализирующееся на долгосрочной аренде для иностранцев. Команда говорит на многих языках и помогает в безопасном процессе аренды.',
        tags: ['real-estate-agency', 'ua-speaking', 'relocation'],
        image: 'hamilton-may.png',
        webpage: 'https://www.hamiltonmay.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Cybulskiego 3', voivodeship: 'mazowieckie', latitude: 52.2135, longitude: 21.0215, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 22 428 16 15' },
            { city: 'Kraków', street: 'ul. św. Gertrudy 10', voivodeship: 'malopolskie', latitude: 50.0572, longitude: 19.9412, openingHours: standardShopHours },
            { city: 'Wrocław', street: 'ul. św. Antoniego 2/4', voivodeship: 'dolnoslaskie', latitude: 51.1095, longitude: 17.0264, openingHours: standardShopHours },
        ],
    });

// 2. Metrohouse
//     await seedService({
//         name: 'Metrohouse',
//         slug: 'metrohouse-network',
//         category: 'real_estate',
//         plDesc: 'Największa w Polsce sieć biur nieruchomości. Wiele oddziałów posiada dedykowanych doradców dla obywateli Ukrainy, oferując wsparcie w negocjacjach i tłumaczeniu umów.',
//         ukDesc: 'Найбільша мережа агентств нерухомості в Польщі. Багато відділень мають спеціальних консультантів для громадян України, пропонуючи підтримку в переговорах та перекладі договорів.',
//         enDesc: 'The largest real estate agency network in Poland. Many branches have dedicated advisors for Ukrainian citizens, offering support in negotiations and contract translation.',
//         ruDesc: 'Крупнейшая сеть агентств недвижимости в Польше. Многие филиалы имеют специальных консультантов для граждан Украины, предлагая поддержку в переговорах и переводе договоров.',
//         tags: ['real-estate-agency', 'ua-speaking', 'verified-offers'],
//         image: 'metrohouse.png',
//         webpage: 'https://metrohouse.pl/',
//         locations: [
//             { city: 'Warszawa', street: 'ul. Świętokrzyska 30', voivodeship: 'mazowieckie', latitude: 52.2355, longitude: 21.0045, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 22 101 01 01' },
//             { city: 'Gdańsk', street: 'ul. Grunwaldzka 102', voivodeship: 'pomorskie', latitude: 54.3795, longitude: 18.6045, openingHours: standardShopHours },
//         ],
//     });

// 3. Freedom Nieruchomości

// 4. Lion's Estate
    await seedService({
        name: 'Lion\'s Estate',
        slug: 'lions-estate',
        category: 'real_estate',
        plDesc: 'Specjaliści od relokacji i najmu w dużych miastach. Firma posiada zespół ekspertów posługujących się językiem ukraińskim, pomagający w znalezieniu lokalu spełniającego wymogi wizowe.',
        ukDesc: 'Фахівці з релокації та оренди у великих містах. Компанія має команду експертів, які розмовляють українською мовою, допомагаючи знайти житло, що відповідає візовим вимогам.',
        enDesc: 'Specialists in relocation and rental in large cities. The company has a team of experts fluent in Ukrainian, helping to find premises that meet visa requirements.',
        ruDesc: 'Специалисты по релокации и аренде в крупных городах. Компания располагает командой экспертов, говорящих на украинском языке, помогающих найти жилье, соответствующее визовым требованиям.',
        tags: ['real-estate-agency', 'ua-speaking', 'relocation'],
        image: 'lion-estate.png',
        webpage: 'https://www.lionsestate.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Wiejska 11', voivodeship: 'mazowieckie', latitude: 52.2272, longitude: 21.0268, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 22 826 66 66' },
        ],
    });

// 5. Partners International
    await seedService({
        name: 'Partners International',
        slug: 'partners-international',
        category: 'real_estate',
        plDesc: 'Eksperci w obsłudze klientów zagranicznych. Oferują pełną obsługę transakcji najmu, weryfikację stanu prawnego lokali oraz wsparcie w języku ukraińskim i angielskim.',
        ukDesc: 'Експерти з обслуговування іноземних клієнтів. Пропонують повний супровід орендних операцій, перевірку юридичного стану приміщень та підтримку українською та англійською мовами.',
        enDesc: 'Experts in serving foreign clients. They offer full service of rental transactions, verification of the legal status of premises, and support in Ukrainian and English.',
        ruDesc: 'Эксперты по обслуживанию иностранных клиентов. Предлагают полное сопровождение сделок по аренде, проверку юридического статуса помещений и поддержку на украинском и английском языках.',
        tags: ['real-estate-agency', 'ua-speaking', 'relocation'],
        image: 'partners-international.png',
        webpage: 'https://www.partnersinternational.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Mokotowska 33', voivodeship: 'mazowieckie', latitude: 52.2215, longitude: 21.021, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 22 258 40 18' },
        ],
    });

    // --- RENOVATION TAGS ---
    const renovationTags = [
        { key: 'tiles', pl: 'Płytki', uk: 'Плитка', en: 'Tiles', ru: 'Плитка' },
        { key: 'flooring', pl: 'Podłogi', uk: 'Підлоги', en: 'Flooring', ru: 'Полы' },
        { key: 'drywall', pl: 'Zabudowa GK', uk: 'Гіпсокартон', en: 'Drywall', ru: 'Гипсокартон' },
        { key: 'painting', pl: 'Malowanie', uk: 'Фарбування', en: 'Painting', ru: 'Покраска' },
        { key: 'finishing', pl: 'Wykończenia', uk: 'Оздоблення', en: 'Finishing', ru: 'Отделка' },
        { key: 'repair', pl: 'Naprawa', uk: 'Ремонт', en: 'Repair', ru: 'Ремонт' },
    ];

    for (const t of renovationTags) {
        const [tag] = await db.insert(tagsTable).values({}).returning();
        await db.insert(tagsTranslationsTable).values([
            { tagId: tag.id, languageCode: 'pl', name: t.pl },
            { tagId: tag.id, languageCode: 'uk', name: t.uk },
            { tagId: tag.id, languageCode: 'en', name: t.en },
            { tagId: tag.id, languageCode: 'ru', name: t.ru },
        ]);
        tagMap[t.key] = tag.id;
    }

    // --- RENOVATION ---

    // 1. IURII DZIALA
    await seedService({
        name: 'IURII DZIALA',
        slug: 'iurii-dziala',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Specjalista od remontów wykończeniowych z 18-letnim doświadczeniem. Układanie płytek, paneli podłogowych, zabudowa GK, szpachlowanie, malowanie i inne roboty wykończeniowe. Obsługuje region opolski.',
        ukDesc: 'Спеціаліст з оздоблювальних ремонтів з 18-річним досвідом. Укладання плитки, підлогових панелей, монтаж гіпсокартону, шпаклювання, фарбування та інші оздоблювальні роботи. Обслуговує Опольський регіон.',
        enDesc: 'Finishing renovation specialist with 18 years of experience. Tile laying, floor panels, drywall installation, plastering, painting and other finishing works. Serves the Opole region.',
        ruDesc: 'Специалист по отделочным ремонтам с 18-летним опытом. Укладка плитки, напольных панелей, монтаж гипсокартона, шпаклёвка, покраска и другие отделочные работы. Обслуживает Опольский регион.',
        tags: ['tiles', 'flooring', 'drywall', 'painting', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/wnlouqwq',
        locations: [
            { city: 'Chróścice', street: null, voivodeship: 'opolskie', latitude: 50.6763, longitude: 17.8875, openingHours: standardShopHours, isMainLocation: true, email: 'iuriidziala@gmail.com' },
        ],
    });

    // 2. UKR BUD
    await seedService({
        name: 'UKR BUD',
        slug: 'ukr-bud',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Firma budowlano-remontowa z 9-letnim doświadczeniem. Specjalizacja: budowa domów, prace betonowe, fundamenty, dachy, murarstwo, ciesielstwo i rozbiórki. Obsługuje Wrocław i okolice w promieniu ok. 50 km.',
        ukDesc: 'Будівельно-ремонтна фірма з 9-річним досвідом. Спеціалізація: будівництво будинків, бетонні роботи, фундаменти, покрівлі, мурування, теслярство та демонтаж. Обслуговує Вроцлав та околиці в радіусі близько 50 км.',
        enDesc: 'Construction and renovation company with 9 years of experience. Specializing in house building, concrete work, foundations, roofing, masonry, carpentry and demolition. Serves Wrocław and surroundings within approx. 50 km radius.',
        ruDesc: 'Строительно-ремонтная фирма с 9-летним опытом. Специализация: строительство домов, бетонные работы, фундаменты, кровли, кладка, плотницкие работы и демонтаж. Обслуживает Вроцлав и окрестности в радиусе около 50 км.',
        tags: ['repair', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/sicxc5mb',
        locations: [
            { city: 'Wrocław', street: null, voivodeship: 'dolnoslaskie', latitude: 51.1079, longitude: 17.0385, openingHours: standardShopHours, isMainLocation: true, email: 'exdima@op.pl' },
        ],
    });

    // 3. REMONT & BUDOWA ROMAN BORDIUH
    await seedService({
        name: 'Remont & Budowa Roman Bordiuh',
        slug: 'remont-budowa-roman-bordiuh',
        category: 'renovation',
        image: 'remont3.png',
        ukName: 'Ремонт і Будівництво Роман Бордюг', enName: 'Renovation & Construction Roman Bordiuh', ruName: 'Ремонт и Строительство Роман Бордюг',
        plDesc: 'Kompleksowe usługi remontowo-budowlane w Warszawie i okolicach (promień 40 km). Malowanie, zabudowa GK, układanie płytek, sufity podwieszane, panele podłogowe, parkiety, montaż drzwi i okien, instalacje elektryczne oraz montaż mebli.',
        ukDesc: 'Комплексні ремонтно-будівельні послуги у Варшаві та околицях (радіус 40 км). Фарбування, монтаж гіпсокартону, укладання плитки, підвісні стелі, підлогові панелі, паркет, монтаж дверей і вікон, електричні інсталяції та збирання меблів.',
        enDesc: 'Comprehensive renovation and construction services in Warsaw and surroundings (40 km radius). Painting, drywall, tile installation, suspended ceilings, floor panels, parquet, door and window installation, electrical work and furniture assembly.',
        ruDesc: 'Комплексные ремонтно-строительные услуги в Варшаве и окрестностях (радиус 40 км). Покраска, монтаж гипсокартона, укладка плитки, подвесные потолки, напольные панели, паркет, установка дверей и окон, электромонтаж и сборка мебели.',
        tags: ['tiles', 'flooring', 'drywall', 'painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/2byjmok5',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, email: 'roman.bordug74@gmail.com' },
        ],
    });

    // 4. Ukraiński Specjalistu - Oleh Kopytko
    await seedService({
        name: 'Ukraiński Specjalistu',
        slug: 'ukrainski-specjalistu',
        category: 'renovation',
        image: 'remont4.png',
        ukName: 'Український Спеціаліст', enName: 'Ukrainian Specialist', ruName: 'Украинский Специалист',
        plDesc: 'Ukraiński specjalista remontowo-budowlany z 9-letnim doświadczeniem. Zabudowa GK, malowanie ścian i sufitów, szpachlowanie, układanie paneli, budowa domów, prace złotej rączki i sprzątanie poremontowe. Warszawa i okolice.',
        ukDesc: 'Український спеціаліст з ремонту та будівництва з 9-річним досвідом. Монтаж гіпсокартону, фарбування стін та стель, шпаклювання, укладання панелей, будівництво будинків, дрібний ремонт та прибирання після ремонту. Варшава та околиці.',
        enDesc: 'Ukrainian renovation and construction specialist with 9 years of experience. Drywall installation, wall and ceiling painting, plastering, panel laying, house building, handyman services and post-renovation cleaning. Warsaw and surroundings.',
        ruDesc: 'Украинский специалист по ремонту и строительству с 9-летним опытом. Монтаж гипсокартона, покраска стен и потолков, шпаклёвка, укладка панелей, строительство домов, мелкий ремонт и уборка после ремонта. Варшава и окрестности.',
        tags: ['drywall', 'painting', 'flooring', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/3pQiWRTb',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 5. Korzhak Gallen
    await seedService({
        name: 'Korzhak Gallen',
        slug: 'korzhak-gallen',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Firma specjalizująca się w kompleksowych remontach mieszkań, domów oraz lokali biurowych i usługowych. Wykończenia od stanu deweloperskiego pod klucz. 16 lat doświadczenia. Wrocław i okolice.',
        ukDesc: 'Фірма, що спеціалізується на комплексних ремонтах квартир, будинків та офісних і комерційних приміщень. Оздоблення від стану забудовника під ключ. 16 років досвіду. Вроцлав та околиці.',
        enDesc: 'Company specializing in comprehensive renovations of apartments, houses, and office/commercial spaces. Turnkey finishing from developer state. 16 years of experience. Wrocław and surroundings.',
        ruDesc: 'Фирма, специализирующаяся на комплексных ремонтах квартир, домов и офисных/коммерческих помещений. Отделка от состояния застройщика под ключ. 16 лет опыта. Вроцлав и окрестности.',
        tags: ['tiles', 'flooring', 'drywall', 'painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/korzhak',
        locations: [
            { city: 'Wrocław', street: null, voivodeship: 'dolnoslaskie', latitude: 51.1079, longitude: 17.0385, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 6. PINKEL BUD
    await seedService({
        name: 'Pinkel Bud',
        slug: 'pinkel-bud',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Wykończenia wysokiego standardu z 16-letnim doświadczeniem. Tynki dekoracyjne, stiuk wenecki, beton architektoniczny, instalacje LED, zabudowa GK, sufity podwieszane, wygłuszanie, adaptacje poddaszy. 558 opinii na Fixly (4.8/5). Warszawa i okolice.',
        ukDesc: 'Оздоблення високого стандарту з 16-річним досвідом. Декоративні штукатурки, венеціанський стук, архітектурний бетон, LED-інсталяції, монтаж гіпсокартону, підвісні стелі, звукоізоляція, адаптація мансард. 558 відгуків на Fixly (4.8/5). Варшава та околиці.',
        enDesc: 'High-standard finishing with 16 years of experience. Decorative plasters, Venetian stucco, architectural concrete, LED installations, drywall, suspended ceilings, soundproofing, attic adaptations. 558 reviews on Fixly (4.8/5). Warsaw and surroundings.',
        ruDesc: 'Отделка высокого стандарта с 16-летним опытом. Декоративные штукатурки, венецианский стук, архитектурный бетон, LED-инсталляции, монтаж гипсокартона, подвесные потолки, звукоизоляция, адаптация мансард. 558 отзывов на Fixly (4.8/5). Варшава и окрестности.',
        tags: ['drywall', 'painting', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/7zvBYJNR',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, email: 'pinkel2020@interia.pl' },
        ],
    });

    // 7. IRB Groups - Dmytro Andriutsa
    await seedService({
        name: 'IRB Groups',
        slug: 'irb-groups',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Montaż ogrzewania, instalacje wod-kan, elektryka, remonty wykończeniowe, zabudowa GK ścian i sufitów, płytki i gres. 16 lat doświadczenia. Ocena 5.0/5 na Fixly. Warszawa i okolice (40 km).',
        ukDesc: 'Монтаж опалення, водопровідні та каналізаційні інсталяції, електрика, оздоблювальні ремонти, монтаж гіпсокартону стін і стель, плитка та керамограніт. 16 років досвіду. Оцінка 5.0/5 на Fixly. Варшава та околиці (40 км).',
        enDesc: 'Heating installation, plumbing, electrical work, finishing renovations, drywall walls and ceilings, tiles and porcelain stoneware. 16 years of experience. Rated 5.0/5 on Fixly. Warsaw and surroundings (40 km).',
        ruDesc: 'Монтаж отопления, водопроводные и канализационные инсталляции, электрика, отделочные ремонты, монтаж гипсокартона стен и потолков, плитка и керамогранит. 16 лет опыта. Оценка 5.0/5 на Fixly. Варшава и окрестности (40 км).',
        tags: ['tiles', 'drywall', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/dmytro-andriutsa-wijgeqase',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 8. Va-Ro - Vasyl Savko
    await seedService({
        name: 'Va-Ro',
        slug: 'va-ro',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Montaż i serwis klimatyzacji, rekuperacji oraz wentylacji. Czyszczenie, odgrzybianie i naprawa klimatyzacji. 10 lat doświadczenia. Ocena 5.0/5 na Fixly. Oleśnica, Wrocław i okolice (40 km).',
        ukDesc: 'Монтаж та сервіс кондиціонерів, рекуперації та вентиляції. Чистка, дезінфекція та ремонт кондиціонерів. 10 років досвіду. Оцінка 5.0/5 на Fixly. Олесниця, Вроцлав та околиці (40 км).',
        enDesc: 'Air conditioning, recuperation and ventilation installation and service. Cleaning, decontamination and repair of AC systems. 10 years of experience. Rated 5.0/5 on Fixly. Oleśnica, Wrocław and surroundings (40 km).',
        ruDesc: 'Монтаж и сервис кондиционеров, рекуперации и вентиляции. Чистка, дезинфекция и ремонт кондиционеров. 10 лет опыта. Оценка 5.0/5 на Fixly. Олесница, Вроцлав и окрестности (40 км).',
        tags: ['ac', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/cdvbjg0q',
        locations: [
            { city: 'Oleśnica', street: null, voivodeship: 'dolnoslaskie', latitude: 51.2099, longitude: 17.3936, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 9. Satelit Pl19 - Oleh Nychyporuk
    await seedService({
        name: 'Satelit Pl19',
        slug: 'satelit-pl19',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Pełny zakres usług elektrycznych, instalacje hydrauliczne i wod-kan, instalacje przeciwpożarowe i gazowe. 16 lat doświadczenia. Ocena 5.0/5 na Fixly. Gdańsk, Gdynia, Sopot i okolice (40 km).',
        ukDesc: 'Повний спектр електричних послуг, гідравлічні та водопровідні інсталяції, протипожежні та газові інсталяції. 16 років досвіду. Оцінка 5.0/5 на Fixly. Гданськ, Гдиня, Сопот та околиці (40 км).',
        enDesc: 'Full range of electrical services, hydraulic and plumbing installations, fire protection and gas installations. 16 years of experience. Rated 5.0/5 on Fixly. Gdańsk, Gdynia, Sopot and surroundings (40 km).',
        ruDesc: 'Полный спектр электрических услуг, гидравлические и водопроводные инсталляции, противопожарные и газовые установки. 16 лет опыта. Оценка 5.0/5 на Fixly. Гданьск, Гдыня, Сопот и окрестности (40 км).',
        tags: ['repair', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/oleh-nychyporuk-hyrhvpl_h',
        locations: [
            { city: 'Gdańsk', street: null, voivodeship: 'pomorskie', latitude: 54.352, longitude: 18.6466, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 10. Weekendowo - Volodymyr Handzyuk
    await seedService({
        name: 'Weekendowo',
        slug: 'weekendowo',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Usługi hydrauliczne i elektryczne, kompleksowe remonty łazienek, układanie glazury i terakoty, malowanie, zabudowa GK, montaż podłóg. 19 lat doświadczenia. Ocena 5.0/5 na Fixly. Warszawa i okolice (50 km).',
        ukDesc: 'Гідравлічні та електричні послуги, комплексні ремонти ванних кімнат, укладання глазурі та теракоти, фарбування, монтаж гіпсокартону, укладання підлог. 19 років досвіду. Оцінка 5.0/5 на Fixly. Варшава та околиці (50 км).',
        enDesc: 'Plumbing and electrical services, comprehensive bathroom renovations, tile laying, painting, drywall, flooring installation. 19 years of experience. Rated 5.0/5 on Fixly. Warsaw and surroundings (50 km).',
        ruDesc: 'Гидравлические и электрические услуги, комплексные ремонты ванных комнат, укладка глазури и терракоты, покраска, монтаж гипсокартона, укладка полов. 19 лет опыта. Оценка 5.0/5 на Fixly. Варшава и окрестности (50 км).',
        tags: ['tiles', 'flooring', 'drywall', 'painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/volodymyr-handzyuk-dwptzh9dz',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 11. Oleh Honcharuk
    await seedService({
        name: 'Oleh Honcharuk',
        slug: 'oleh-honcharuk',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Kompleksowe usługi remontowe, instalacyjne, hydrauliczne i elektryczne. Malowanie, prace złotej rączki. 16 lat doświadczenia w branży. Warszawa i okolice (50 km).',
        ukDesc: 'Комплексні ремонтні, монтажні, гідравлічні та електричні послуги. Фарбування, послуги майстра на всі руки. 16 років досвіду в галузі. Варшава та околиці (50 км).',
        enDesc: 'Comprehensive renovation, installation, plumbing and electrical services. Painting, handyman work. 16 years of industry experience. Warsaw and surroundings (50 km).',
        ruDesc: 'Комплексные ремонтные, монтажные, гидравлические и электрические услуги. Покраска, услуги мастера на все руки. 16 лет опыта в отрасли. Варшава и окрестности (50 км).',
        tags: ['painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/kyxceoip',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 12. DS Remonty i Wykończenia - Dmytro Shelest
    await seedService({
        name: 'DS Remonty i Wykończenia',
        slug: 'ds-remonty-i-wykonczenia',
        category: 'renovation',
        image: 'remont2.png',
        ukName: 'DS Ремонти та Оздоблення', enName: 'DS Renovations & Finishing', ruName: 'DS Ремонты и Отделка',
        plDesc: 'Sufity podwieszane, ścianki działowe, malowanie, tynkowanie, szpachlowanie ścian. Gwarancja jakości. 386 usług w tym hydraulika, montaż okien i drzwi, ogrzewanie. 8 lat doświadczenia, ocena 4.8/5 (61 opinii). Kraków i okolice.',
        ukDesc: 'Підвісні стелі, перегородки, фарбування, штукатурення, шпаклювання стін. Гарантія якості. 386 послуг включаючи сантехніку, монтаж вікон і дверей, опалення. 8 років досвіду, оцінка 4.8/5 (61 відгук). Краків та околиці.',
        enDesc: 'Suspended ceilings, partition walls, painting, plastering, wall finishing. Quality guaranteed. 386 services including plumbing, window/door installation, heating. 8 years of experience, rated 4.8/5 (61 reviews). Kraków and surroundings.',
        ruDesc: 'Подвесные потолки, перегородки, покраска, штукатурка, шпаклёвка стен. Гарантия качества. 386 услуг включая сантехнику, монтаж окон и дверей, отопление. 8 лет опыта, оценка 4.8/5 (61 отзыв). Краков и окрестности.',
        tags: ['drywall', 'painting', 'finishing', 'tiles', 'flooring', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/GYwmqLQk',
        locations: [
            { city: 'Kraków', street: null, voivodeship: 'malopolskie', latitude: 50.0647, longitude: 19.945, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 13. Vasyl Zakharuk
    await seedService({
        name: 'Vasyl Zakharuk',
        slug: 'vasyl-zakharuk',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Malowanie ścian, zabudowa GK, tapetowanie, wykończenia podłóg, remonty łazienek i kuchni, montaż mebli, prace złotej rączki. 19 lat doświadczenia, ocena 5.0/5 na Fixly. Kraków i okolice (40 km).',
        ukDesc: 'Фарбування стін, монтаж гіпсокартону, шпалерування, оздоблення підлог, ремонти ванних кімнат і кухонь, збирання меблів, послуги майстра. 19 років досвіду, оцінка 5.0/5 на Fixly. Краків та околиці (40 км).',
        enDesc: 'Wall painting, drywall, wallpapering, floor finishing, bathroom and kitchen renovations, furniture assembly, handyman services. 19 years of experience, rated 5.0/5 on Fixly. Kraków and surroundings (40 km).',
        ruDesc: 'Покраска стен, монтаж гипсокартона, поклейка обоев, отделка полов, ремонт ванных комнат и кухонь, сборка мебели, услуги мастера. 19 лет опыта, оценка 5.0/5 на Fixly. Краков и окрестности (40 км).',
        tags: ['painting', 'drywall', 'flooring', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/pJdy0tFO',
        locations: [
            { city: 'Kraków', street: null, voivodeship: 'malopolskie', latitude: 50.0647, longitude: 19.945, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 14. STB - Volodymyr Yurkevych
    await seedService({
        name: 'STB',
        slug: 'stb-yurkevych',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Remonty mieszkań o dowolnym stopniu trudności w krótkim terminie. Malowanie, układanie płytek, zabudowa GK, podłogi, sufity podwieszane, ocieplenie poddaszy. 8 lat doświadczenia, ocena 5.0/5 (27 opinii). Warszawa i okolice (20 km).',
        ukDesc: 'Ремонти квартир будь-якої складності в короткі терміни. Фарбування, укладання плитки, монтаж гіпсокартону, підлоги, підвісні стелі, утеплення мансард. 8 років досвіду, оцінка 5.0/5 (27 відгуків). Варшава та околиці (20 км).',
        enDesc: 'Apartment renovations of any difficulty in short timeframes. Painting, tile laying, drywall, flooring, suspended ceilings, attic insulation. 8 years of experience, rated 5.0/5 (27 reviews). Warsaw and surroundings (20 km).',
        ruDesc: 'Ремонт квартир любой сложности в короткие сроки. Покраска, укладка плитки, монтаж гипсокартона, полы, подвесные потолки, утепление мансард. 8 лет опыта, оценка 5.0/5 (27 отзывов). Варшава и окрестности (20 км).',
        tags: ['tiles', 'drywall', 'painting', 'flooring', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/volodymyr-yurkevych-1y_04tsya',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 15. Volodymyr Lytvynenko
    await seedService({
        name: 'Volodymyr Lytvynenko',
        slug: 'volodymyr-lytvynenko',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Układanie płytek, parkietów i paneli, zabudowa GK, szpachlowanie, sufity podwieszane, prace fundamentowe i konstrukcyjne. 16 lat doświadczenia. Kraków i okolice (40 km).',
        ukDesc: 'Укладання плитки, паркету та панелей, монтаж гіпсокартону, шпаклювання, підвісні стелі, фундаментні та конструкційні роботи. 16 років досвіду. Краків та околиці (40 км).',
        enDesc: 'Tile, parquet and panel laying, drywall, plastering, suspended ceilings, foundation and structural work. 16 years of experience. Kraków and surroundings (40 km).',
        ruDesc: 'Укладка плитки, паркета и панелей, монтаж гипсокартона, шпаклёвка, подвесные потолки, фундаментные и конструкционные работы. 16 лет опыта. Краков и окрестности (40 км).',
        tags: ['tiles', 'flooring', 'drywall', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/flreagps',
        locations: [
            { city: 'Kraków', street: null, voivodeship: 'malopolskie', latitude: 50.0647, longitude: 19.945, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 16. Dmytro Melnyk
    await seedService({
        name: 'Dmytro Melnyk',
        slug: 'dmytro-melnyk',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Specjalista od poddaszy — adaptacja, ocieplenie, ocieplenie pianką, remont, zabudowa. Gipsowanie i szpachlowanie ścian. Kraków i okolice.',
        ukDesc: 'Спеціаліст з мансард — адаптація, утеплення, утеплення піною, ремонт, обшивка. Гіпсування та шпаклювання стін. Краків та околиці.',
        enDesc: 'Attic specialist — adaptation, insulation, spray foam insulation, renovation, finishing. Plastering and wall finishing. Kraków and surroundings.',
        ruDesc: 'Специалист по мансардам — адаптация, утепление, утепление пеной, ремонт, обшивка. Гипсование и шпаклёвка стен. Краков и окрестности.',
        tags: ['drywall', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/lkefsznq',
        locations: [
            { city: 'Kraków', street: null, voivodeship: 'malopolskie', latitude: 50.0647, longitude: 19.945, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 17. Dmytro Andriievskyi
    await seedService({
        name: 'Dmytro Andriievskyi',
        slug: 'dmytro-andriievskyi',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Malowanie ścian, układanie płytek, zabudowa GK, podłogi, remonty łazienek, wykończenia wnętrz. Kraków i okolice (40 km).',
        ukDesc: 'Фарбування стін, укладання плитки, монтаж гіпсокартону, підлоги, ремонти ванних кімнат, оздоблення інтер\'єрів. Краків та околиці (40 км).',
        enDesc: 'Wall painting, tile laying, drywall, flooring, bathroom renovations, interior finishing. Kraków and surroundings (40 km).',
        ruDesc: 'Покраска стен, укладка плитки, монтаж гипсокартона, полы, ремонт ванных комнат, отделка интерьеров. Краков и окрестности (40 км).',
        tags: ['painting', 'tiles', 'drywall', 'flooring', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/zs42ouw6',
        locations: [
            { city: 'Kraków', street: null, voivodeship: 'malopolskie', latitude: 50.0647, longitude: 19.945, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 18. m2 Firma budowlana - Volodymyr Maksymyk
    await seedService({
        name: 'Volodymyr Maksymyk m2 Firma Budowlana',
        slug: 'm2-firma-budowlana',
        category: 'renovation',
        image: 'remont3.png',
        ukName: 'm2 Будівельна Фірма', enName: 'm2 Construction Company', ruName: 'm2 Строительная Компания',
        plDesc: 'Malowanie, wykończenia ścian, podłogi, remonty łazienek i kuchni, tynki maszynowe. Poznań i okolice (49 km).',
        ukDesc: 'Фарбування, оздоблення стін, підлоги, ремонти ванних кімнат і кухонь, машинні штукатурки. Познань та околиці (49 км).',
        enDesc: 'Painting, wall finishing, flooring, bathroom and kitchen renovations, machine plastering. Poznań and surroundings (49 km).',
        ruDesc: 'Покраска, отделка стен, полы, ремонт ванных комнат и кухонь, машинная штукатурка. Познань и окрестности (49 км).',
        tags: ['painting', 'flooring', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://www.facebook.com/m2remontofficial',
        locations: [
            { city: 'Poznań', street: null, voivodeship: 'wielkopolskie',phoneNumber: '+380 95 615 8777', latitude: 52.4064, longitude: 16.9252, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 19. E.M Bud - Dmytro Afonin
    await seedService({
        name: 'E.M Bud',
        slug: 'em-bud',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Malowanie, szpachlowanie, ocieplenie, wykończenia wnętrz, montaż listew i naprawy konstrukcyjne. Meble i sprzątanie poremontowe. 4 lata doświadczenia, ocena 4.9/5 (21 opinii). Poznań i okolice (50 km).',
        ukDesc: 'Фарбування, шпаклювання, утеплення, оздоблення інтер\'єрів, монтаж плінтусів та конструкційні ремонти. Меблі та прибирання після ремонту. 4 роки досвіду, оцінка 4.9/5 (21 відгук). Познань та околиці (50 км).',
        enDesc: 'Painting, plastering, insulation, interior finishing, baseboard installation and structural repairs. Furniture and post-renovation cleaning. 4 years of experience, rated 4.9/5 (21 reviews). Poznań and surroundings (50 km).',
        ruDesc: 'Покраска, шпаклёвка, утепление, отделка интерьеров, монтаж плинтусов и конструкционные ремонты. Мебель и уборка после ремонта. 4 года опыта, оценка 4.9/5 (21 отзыв). Познань и окрестности (50 км).',
        tags: ['painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/0ku3bpls',
        locations: [
            { city: 'Poznań', street: null, voivodeship: 'wielkopolskie', latitude: 52.4064, longitude: 16.9252, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 20. IVI BUD - Ihor Mysko
    await seedService({
        name: 'IVI BUD',
        slug: 'ivi-bud',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Firma budowlana — kompleksowe remonty budynków, mieszkań i biur. Malowanie, szpachlowanie, płytki, podłogi, zabudowa GK, instalacje elektryczne, sprzątanie. Ponad 20 lat doświadczenia. Poznań i okolice (15 km).',
        ukDesc: 'Будівельна фірма — комплексні ремонти будівель, квартир та офісів. Фарбування, шпаклювання, плитка, підлоги, монтаж гіпсокартону, електричні інсталяції, прибирання. Понад 20 років досвіду. Познань та околиці (15 км).',
        enDesc: 'Construction company — comprehensive building, apartment and office renovations. Painting, plastering, tiles, flooring, drywall, electrical installations, cleaning. Over 20 years of experience. Poznań and surroundings (15 km).',
        ruDesc: 'Строительная фирма — комплексные ремонты зданий, квартир и офисов. Покраска, шпаклёвка, плитка, полы, монтаж гипсокартона, электроинсталляции, уборка. Более 20 лет опыта. Познань и окрестности (15 км).',
        tags: ['painting', 'tiles', 'flooring', 'drywall', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/ytw1l97n',
        locations: [
            { city: 'Poznań', street: null, voivodeship: 'wielkopolskie', latitude: 52.4064, longitude: 16.9252, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 21. Dmytro Akhtyniuk
    await seedService({
        name: 'Dmytro Akhtyniuk',
        slug: 'dmytro-akhtyniuk',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Malowanie, remonty mieszkań, domów, łazienek i kuchni, zabudowa GK, podłogi, prace złotej rączki. 8 lat doświadczenia, ocena 5.0/5. Poznań i okolice (40 km).',
        ukDesc: 'Фарбування, ремонти квартир, будинків, ванних кімнат і кухонь, монтаж гіпсокартону, підлоги, послуги майстра. 8 років досвіду, оцінка 5.0/5. Познань та околиці (40 км).',
        enDesc: 'Painting, apartment, house, bathroom and kitchen renovations, drywall, flooring, handyman services. 8 years of experience, rated 5.0/5. Poznań and surroundings (40 km).',
        ruDesc: 'Покраска, ремонт квартир, домов, ванных комнат и кухонь, монтаж гипсокартона, полы, услуги мастера. 8 лет опыта, оценка 5.0/5. Познань и окрестности (40 км).',
        tags: ['painting', 'drywall', 'flooring', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/frmglsru',
        locations: [
            { city: 'Poznań', street: null, voivodeship: 'wielkopolskie', latitude: 52.4064, longitude: 16.9252, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 22. Vasyl Tsiupa
    await seedService({
        name: 'Vasyl Tsiupa',
        slug: 'vasyl-tsiupa',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Remonty, malowanie, instalacje hydrauliczne i elektryczne, stolarstwo, montaż okien, płytki, prace ogrodowe, złota rączka. 13 lat doświadczenia w budownictwie, ocena 4.9/5 (27 opinii). Warszawa i okolice (31 km).',
        ukDesc: 'Ремонти, фарбування, гідравлічні та електричні інсталяції, столярство, монтаж вікон, плитка, садові роботи, майстер на всі руки. 13 років досвіду в будівництві, оцінка 4.9/5 (27 відгуків). Варшава та околиці (31 км).',
        enDesc: 'Renovations, painting, plumbing and electrical installations, carpentry, window installation, tiles, landscaping, handyman services. 13 years of construction experience, rated 4.9/5 (27 reviews). Warsaw and surroundings (31 km).',
        ruDesc: 'Ремонты, покраска, гидравлические и электрические инсталляции, столярство, монтаж окон, плитка, садовые работы, мастер на все руки. 13 лет опыта в строительстве, оценка 4.9/5 (27 отзывов). Варшава и окрестности (31 км).',
        tags: ['painting', 'tiles', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/lnl6z68f',
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 23. Serwis Remont - Ihor Sobol
    await seedService({
        name: 'Serwis Remont Ihor Sobol',
        slug: 'serwis-remont-ihor-sobol',
        category: 'renovation',
        image: 'remont3.png',
        ukName: 'Сервіс Ремонт Ігор Соболь', enName: 'Repair Service Ihor Sobol', ruName: 'Сервис Ремонт Игорь Соболь',
        plDesc: 'Remonty, montaż i naprawy, malowanie, budowa domów, hydraulika i elektryka. Wrocław i okolice (50 km).',
        ukDesc: 'Ремонти, монтаж та ремонти, фарбування, будівництво будинків, сантехніка та електрика. Вроцлав та околиці (50 км).',
        enDesc: 'Renovations, installation and repairs, painting, house building, plumbing and electrical work. Wrocław and surroundings (50 km).',
        ruDesc: 'Ремонты, монтаж и ремонты, покраска, строительство домов, сантехника и электрика. Вроцлав и окрестности (50 км).',
        tags: ['painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/m1m5tfjm',
        locations: [
            { city: 'Wrocław', street: null, voivodeship: 'dolnoslaskie', latitude: 51.1079, longitude: 17.0385, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 24. Oleh Babych
    await seedService({
        name: 'Oleh Babych',
        slug: 'oleh-babych',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Specjalista malarz — malowanie ścian, sufitów, drzwi, płytek, tapetowanie, malowanie dekoracyjne, gruntowanie. Ponad 20 lat doświadczenia, ocena 5.0/5. Poznań i okolice (40 km).',
        ukDesc: 'Спеціаліст маляр — фарбування стін, стель, дверей, плитки, шпалерування, декоративне фарбування, ґрунтування. Понад 20 років досвіду, оцінка 5.0/5. Познань та околиці (40 км).',
        enDesc: 'Painting specialist — walls, ceilings, doors, tiles, wallpapering, decorative painting, priming. Over 20 years of experience, rated 5.0/5. Poznań and surroundings (40 km).',
        ruDesc: 'Специалист маляр — покраска стен, потолков, дверей, плитки, поклейка обоев, декоративная покраска, грунтовка. Более 20 лет опыта, оценка 5.0/5. Познань и окрестности (40 км).',
        tags: ['painting', 'finishing'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/mo4i13va',
        locations: [
            { city: 'Poznań', street: null, voivodeship: 'wielkopolskie', latitude: 52.4064, longitude: 16.9252, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 25. Volodymyr Shafran
    await seedService({
        name: 'Volodymyr Shafran',
        slug: 'volodymyr-shafran',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Remonty, montaż i naprawy, malowanie, złota rączka, sprzątanie poremontowe, transport. 133 kategorie usług. Ocena 5.0/5. Poznań i okolice.',
        ukDesc: 'Ремонти, монтаж та ремонти, фарбування, майстер на всі руки, прибирання після ремонту, транспорт. 133 категорії послуг. Оцінка 5.0/5. Познань та околиці.',
        enDesc: 'Renovations, installation and repairs, painting, handyman services, post-renovation cleaning, transport. 133 service categories. Rated 5.0/5. Poznań and surroundings.',
        ruDesc: 'Ремонты, монтаж и ремонты, покраска, мастер на все руки, уборка после ремонта, транспорт. 133 категории услуг. Оценка 5.0/5. Познань и окрестности.',
        tags: ['painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/blbzyyaz',
        locations: [
            { city: 'Poznań', street: null, voivodeship: 'wielkopolskie', latitude: 52.4064, longitude: 16.9252, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 26. Vasyl Petrytsiuk
    await seedService({
        name: 'Vasyl Petrytsiuk',
        slug: 'vasyl-petrytsiuk',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Remonty, montaż i naprawy, malowanie, złota rączka, budowa domów, sprzątanie. 190 kategorii usług. Ocena 5.0/5. Poznań i okolice.',
        ukDesc: 'Ремонти, монтаж та ремонти, фарбування, майстер на всі руки, будівництво будинків, прибирання. 190 категорій послуг. Оцінка 5.0/5. Познань та околиці.',
        enDesc: 'Renovations, installation and repairs, painting, handyman services, house building, cleaning. 190 service categories. Rated 5.0/5. Poznań and surroundings.',
        ruDesc: 'Ремонты, монтаж и ремонты, покраска, мастер на все руки, строительство домов, уборка. 190 категорий услуг. Оценка 5.0/5. Познань и окрестности.',
        tags: ['painting', 'drywall', 'flooring', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://fixly.pl/profil/zdqa3sik',
        locations: [
            { city: 'Poznań', street: null, voivodeship: 'wielkopolskie', latitude: 52.4064, longitude: 16.9252, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 27. Art Home - Oleksandr Savka
    await seedService({
        name: 'Art Home',
        slug: 'art-home-wroclaw',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Kompleksowe remonty mieszkań, domów, biur i lokali. Projektowanie wnętrz, meble na zamówienie, montaż mebli. Firma prowadzona przez Oleksandra Savkę. Wrocław.',
        ukDesc: 'Комплексні ремонти квартир, будинків, офісів та приміщень. Дизайн інтер\'єрів, меблі на замовлення, монтаж меблів. Фірма під керівництвом Олександра Савки. Вроцлав.',
        enDesc: 'Comprehensive renovations of apartments, houses, offices and premises. Interior design, custom furniture, furniture installation. Company run by Oleksandr Savka. Wrocław.',
        ruDesc: 'Комплексные ремонты квартир, домов, офисов и помещений. Дизайн интерьеров, мебель на заказ, монтаж мебели. Фирма под руководством Александра Савки. Вроцлав.',
        tags: ['finishing', 'painting', 'tiles', 'flooring', 'drywall', 'repair'],
        languages: ['pl', 'uk', 'ru'],
        webpage: 'https://art-home-wro.blogspot.com/',
        socials: { facebook: 'https://www.facebook.com/Art.Home.Wro' },
        locations: [
            { city: 'Wrocław', street: null, voivodeship: 'dolnoslaskie', latitude: 51.1079, longitude: 17.0385, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 28. Igor Vonsovic - Remont mieszkania, domy. Wrocław
    await seedService({
        name: 'Igor Vonsovic Remont',
        slug: 'igor-vonsovic-remont',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Remont mieszkań i domów pod klucz we Wrocławiu. Kompleksowe wykończenia wnętrz. Ul. Obrońców Poczty Gdańskiej, Wrocław.',
        ukDesc: 'Ремонт квартир та будинків під ключ у Вроцлаві. Комплексне оздоблення інтер\'єрів. Вул. Оборонців Пошти Гданської, Вроцлав.',
        enDesc: 'Turnkey apartment and house renovation in Wrocław. Comprehensive interior finishing. Obrońców Poczty Gdańskiej street, Wrocław.',
        ruDesc: 'Ремонт квартир и домов под ключ во Вроцлаве. Комплексная отделка интерьеров. Ул. Оборонцув Почты Гданьской, Вроцлав.',
        tags: ['finishing', 'painting', 'tiles', 'flooring', 'drywall', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://www.wykonczeniawnetrzwroclaw.pl/',
        whatsappNumber: '+48796515066',
        socials: { facebook: 'https://www.facebook.com/igorvonsovic' },
        locations: [
            { city: 'Wrocław', phoneNumber: '+48796515066', street: 'ul. Obrońców Poczty Gdańskiej', voivodeship: 'dolnoslaskie', latitude: 51.1079, longitude: 17.0385, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 29. Сергей - Remont квартир Wrocław
    await seedService({
        name: 'Serhiy Remont Wrocław',
        slug: 'serhiy-remont-wroclaw',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Remonty mieszkań we Wrocławiu. Kontakt: Sergiej.',
        ukDesc: 'Ремонт квартир у Вроцлаві. Контакт: Сергій.',
        enDesc: 'Apartment renovations in Wrocław. Contact: Serhiy.',
        ruDesc: 'Ремонт квартир во Вроцлаве. Контакт: Сергей.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk', 'ru'],
        whatsappNumber: '+48 512 123 579',
        locations: [
            { city: 'Wrocław', street: null, voivodeship: 'dolnoslaskie', latitude: 51.1079, longitude: 17.0385, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 512 123 579' },
        ],
    });

    // 30. Oleksandr Hlushchenko - Gdańsk
    await seedService({
        name: 'Oleksandr Hlushchenko Remont',
        slug: 'oleksandr-hlushchenko-remont',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Kompleksowe wykonanie robót budowlanych pod klucz. Remonty mieszkań, biur, domów, salonów wystawowych, sklepów. Płytki, hydraulika, elektryka, GK, prace malarskie i stolarskie. Gdańsk i okolice.',
        ukDesc: 'Комплексне виконання будівельних робіт під ключ. Ремонт квартир, офісів, будинків, виставкових залів, магазинів. Плитка, сантехніка, електрика, гіпсокартон, малярні та столярні роботи. Гданськ та околиці.',
        enDesc: 'Comprehensive turnkey construction work. Renovation of apartments, offices, houses, showrooms, shops. Tiles, plumbing, electrical, drywall, painting and carpentry. Gdańsk and surroundings.',
        ruDesc: 'Комплексное выполнение строительных работ под ключ. Ремонт квартир, офисов, домов, выставочных залов, магазинов. Плитка, сантехника, электрика, гипсокартон, малярные и столярные работы. Гданьск и окрестности.',
        tags: ['tiles', 'drywall', 'painting', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        whatsappNumber: '+48 575 877 119',
        locations: [
            { city: 'Gdańsk', street: null, voivodeship: 'pomorskie', latitude: 54.352, longitude: 18.6466, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 575 877 119', email: 'fop_rad@ukr.net' },
        ],
    });

    // 31. M2 Remont - ремонт під ключ
    await seedService({
        name: 'M2 Remont',
        slug: 'm2-remont',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Kompleksowe remonty mieszkań pod klucz.',
        ukDesc: 'Комплексний ремонт квартир під ключ.',
        enDesc: 'Comprehensive turnkey apartment renovations.',
        ruDesc: 'Комплексный ремонт квартир под ключ.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://remont-m2.com/',
        socials: { facebook: 'https://www.facebook.com/m2remontofficial' },
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // --- WARSZAWA (z postów Facebook) ---

    // 32. Ligaremontu - Vladymyr Tishyn
    await seedService({
        name: 'Ligaremontu',
        slug: 'ligaremontu',
        category: 'renovation',
        image: 'ligaremontu.png',
        plDesc: 'Firma remontowa wykonująca remonty pod klucz. Klejenie włókniny szklanej, papier Knauf po wszystkich kątach. Warszawa.',
        ukDesc: 'Ремонтна фірма, що виконує ремонт під ключ. Поклейка склохолста, папір Кнауф по всіх кутах. Варшава.',
        enDesc: 'Renovation company performing turnkey renovations. Fiberglass wallpaper, Knauf paper on all corners. Warsaw.',
        ruDesc: 'Ремонтная фирма, выполняющая ремонт под ключ. Поклейка стеклохолста, бумага Кнауф по всем углам. Варшава.',
        tags: ['finishing', 'painting', 'drywall', 'repair'],
        languages: ['pl', 'uk'],
        whatsappNumber: '+48666668946',
        socials: { instagram: 'https://www.instagram.com/ligaremontu/' },
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 666 668 946' },
        ],
    });

    // 33. Alex Tatsiuk
    await seedService({
        name: 'Alex Tatsiuk Remont',
        slug: 'alex-tatsiuk-remont',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Jakościowe remonty mieszkań w Warszawie.',
        ukDesc: 'Якісні ремонти квартир у Варшаві.',
        enDesc: 'Quality apartment renovations in Warsaw.',
        ruDesc: 'Качественные ремонты квартир в Варшаве.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 881 213 933', email: 'alvaresandcompany@gmail.com' },
        ],
    });

    // 34. Dmytro Moroz - Imperium
    await seedService({
        name: 'Imperium DVM',
        slug: 'imperium-dvm',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Usługi remontowe w Warszawie.',
        ukDesc: 'Ремонтні послуги у Варшаві.',
        enDesc: 'Renovation services in Warsaw.',
        ruDesc: 'Ремонтные услуги в Варшаве.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        whatsappNumber: '+48697142801',
        socials: { instagram: 'https://www.instagram.com/imperium_dvm_group/', facebook: 'https://www.facebook.com/p/Imperium-DVM-GROUP-100049169688092/' },
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 697 142 801', email: 'imperium.dvm@gmail.com' },
        ],
    });

    // 35. Andrij Kolodiazhnyj
    await seedService({
        name: 'Andrij Kolodiazhnyj Remont',
        slug: 'andrij-kolodiazhnyj-remont',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Kompleksowe remonty mieszkań i domów. Elektroinstalacje, hydraulika, tynki, wykończenia, GK, szpachlowanie, malowanie, laminat, płytki, montaż drzwi, demontaż. Warszawa.',
        ukDesc: 'Комплексний ремонт квартир і будинків. Електромонтажні роботи, сантехніка, штукатурка, оздоблення, гіпсокартон, шпаклювання, фарбування, ламінат, плитка, монтаж дверей, демонтаж. Варшава.',
        enDesc: 'Comprehensive apartment and house renovations. Electrical, plumbing, plastering, finishing, drywall, painting, laminate, tiles, door installation, demolition. Warsaw.',
        ruDesc: 'Комплексный ремонт квартир и домов. Электромонтаж, сантехника, штукатурка, отделка, гипсокартон, шпаклёвка, покраска, ламинат, плитка, монтаж дверей, демонтаж. Варшава.',
        tags: ['tiles', 'flooring', 'drywall', 'painting', 'finishing', 'repair'],
        whatsappNumber: '+48 577 594 361',
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 577 594 361' },
        ],
    });

    // 36. Volodymyr - remont Warszawa
    await seedService({
        name: 'Volodymyr Remont Warszawa',
        slug: 'volodymyr-remont-warszawa',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Profesjonalne usługi remontowe mieszkań, domów, biur, salonów. Od kosmetycznego do kapitalnego remontu. Pomoc w wyborze materiałów. Warszawa i okolice.',
        ukDesc: 'Професійні послуги з ремонту квартир, будинків, офісів, салонів. Від косметичного до капітального ремонту. Допомога у виборі матеріалів. Варшава та околиці.',
        enDesc: 'Professional renovation services for apartments, houses, offices, salons. From cosmetic to capital renovation. Help with material selection. Warsaw and surroundings.',
        ruDesc: 'Профессиональные услуги по ремонту квартир, домов, офисов, салонов. От косметического до капитального ремонта. Помощь в выборе материалов. Варшава и окрестности.',
        tags: ['finishing', 'painting', 'tiles', 'repair'],
        whatsappNumber: '+48 886 167 024',
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 886 167 024' },
        ],
    });

    // 37. Vlad Ch - uniwersalny wykończeniowiec
    await seedService({
        name: 'Vlad Ch Remont',
        slug: 'vlad-ch-remont',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Wykończeniowcy-uniwersaliści: płytki, elektryka, hydraulika. Remont mieszkań pod klucz. Warszawa.',
        ukDesc: 'Внутрішні спеціалісти-універсали: плитка, електрика, гідравліка. Ремонт квартир під ключ. Варшава.',
        enDesc: 'Universal interior specialists: tiles, electrical, plumbing. Turnkey apartment renovation. Warsaw.',
        ruDesc: 'Внутренние специалисты-универсалы: плитка, электрика, гидравлика. Ремонт квартир под ключ. Варшава.',
        tags: ['tiles', 'finishing', 'repair'],
        whatsappNumber: '+48 575 364 202',
        languages: ['pl', 'uk', 'ru'],
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 575 364 202' },
        ],
    });

    // 38. Aliaksei Zamyslau - kompleksowy remont
    await seedService({
        name: 'Aliaksei Zamyslau Remont',
        slug: 'aliaksei-zamyslau-remont',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Remont mieszkań, domów, biur. Wykończenia, płytki, GK, parkiet, laminat, elektryka, hydraulika, drzwi, okna, meble, kuchnie, demontaż, wywóz śmieci, transport materiałów, sprzątanie poremontowe. Warszawa i okolice.',
        ukDesc: 'Ремонт квартир, будинків, офісів. Оздоблення, плитка, ГКЛ, паркет, ламінат, електрика, сантехніка, двері, вікна, меблі, кухні, демонтаж, вивіз сміття, транспорт матеріалів, прибирання після ремонту. Варшава та околиці.',
        enDesc: 'Renovation of apartments, houses, offices. Finishing, tiles, drywall, parquet, laminate, electrical, plumbing, doors, windows, furniture, kitchens, demolition, waste removal, material transport, post-renovation cleaning. Warsaw and surroundings.',
        ruDesc: 'Ремонт квартир, домов, офисов. Отделка, плитка, ГКЛ, паркет, ламинат, электрика, сантехника, двери, окна, мебель, кухни, демонтаж, вывоз мусора, транспорт материалов, уборка после ремонта. Варшава и окрестности.',
        tags: ['tiles', 'flooring', 'drywall', 'painting', 'finishing', 'repair'],
        languages: ['pl', 'uk', 'ru'],
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 780 002 838' , email: 'zamyslaualiaksei@gmail.com' },
        ],
    });

    // 40. Ремонт Варшава і околиці (strona FB)
    await seedService({
        name: 'Remonty Warszawa i Okolice',
        slug: 'remont-warszawa-okolice',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Układanie kafelków, elektryka, malowanie pokojowe. Warszawa. Kontakt też przez Telegram.',
        ukDesc: 'Укладання кахлів, електрика, фарбування кімнат. Варшава. Контакт також через Telegram.',
        enDesc: 'Tile laying, electrical work, room painting. Warsaw. Also available via Telegram.',
        ruDesc: 'Укладка кафеля, электрика, покраска комнат. Варшава. Контакт также через Telegram.',
        tags: ['tiles', 'painting', 'repair'],
        languages: ['pl', 'uk'],
        whatsappNumber: '+48 886 969 813',
        socials: { facebook: 'https://www.facebook.com/people/Ремонт-Варшава-і-околиці/61557386745645/', telegram: 'https://t.me/warszawa_remont' },
        locations: [
            { city: 'Warszawa', street: null, voivodeship: 'mazowieckie', latitude: 52.2297, longitude: 21.0122, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 886 969 813' },
        ],
    });

    // 41. Vasilii Zubco - Łódź
    await seedService({
        name: 'Vasilii Zubco Remont',
        slug: 'vasilii-zubco-remont',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Remonty mieszkań i biur: tynki, szpachlowanie, malowanie, płytki. Szybko i tanio. Łódź.',
        ukDesc: 'Ремонт квартир та офісів: штукатурка, шпаклювання, фарбування, плитка. Швидко та недорого. Лодзь.',
        enDesc: 'Apartment and office renovations: plastering, filling, painting, tiles. Fast and affordable. Łódź.',
        ruDesc: 'Ремонт квартир и офисов: штукатурка, шпаклёвка, покраска, плитка. Быстро и недорого. Лодзь.',
        tags: ['painting', 'tiles', 'finishing', 'repair'],
        languages: ['pl', 'uk', 'ru'],
        locations: [
            { city: 'Łódź', street: null, voivodeship: 'lodzkie', latitude: 51.7592, longitude: 19.456, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 575 443 237' },
        ],
    });

    // 42. Дрібний Ремонт - Łódź
    await seedService({
        name: 'Dribnyj Remont',
        slug: 'dribnyj-remont-lodz',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Remonty mieszkań w Łodzi.',
        ukDesc: 'Ремонт квартир у Лодзі.',
        enDesc: 'Apartment renovations in Łódź.',
        ruDesc: 'Ремонт квартир в Лодзи.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Łódź', street: null, voivodeship: 'lodzkie', latitude: 51.7592, longitude: 19.456, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 796 713 544' },
        ],
    });

    // 43. Саня Олександр - Katowice
    await seedService({
        name: 'Oleksandr Remont Katowice',
        slug: 'oleksandr-remont-katowice',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Kompleksowe remonty mieszkań: kapitalny, kosmetyczny, euro, pod klucz, biura. Remonty łazienek, kuchni. Wyrównanie ścian, szpachlowanie, malowanie, parkiet, laminat, płytki, kamień dekoracyjny, elektryka, hydraulika. Katowice.',
        ukDesc: 'Комплексний ремонт квартир: капітальний, косметичний, євро, під ключ, офіси. Ремонт ванної, кухні. Вирівнювання стін, шпаклівка, фарбування, паркет, ламінат, плитка, декоративний камінь, електрика, сантехніка. Катовіце.',
        enDesc: 'Comprehensive apartment renovations: capital, cosmetic, euro, turnkey, offices. Bathroom and kitchen renovations. Wall leveling, plastering, painting, parquet, laminate, tiles, decorative stone, electrical, plumbing. Katowice.',
        ruDesc: 'Комплексный ремонт квартир: капитальный, косметический, евро, под ключ, офисы. Ремонт ванной, кухни. Выравнивание стен, шпаклёвка, покраска, паркет, ламинат, плитка, декоративный камень, электрика, сантехника. Катовице.',
        tags: ['tiles', 'flooring', 'painting', 'drywall', 'finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Katowice', street: null, voivodeship: 'slaskie', latitude: 50.2649, longitude: 19.0238, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 886 125 309' },
        ],
    });

    // 44. Katowice Remonty i Wykończenia (Remontiago)
    await seedService({
        name: 'Remontiago',
        slug: 'remontiago-katowice',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Remonty i wykończenia mieszkań w Katowicach. Bezpłatna konsultacja. Instagram: remontiago.',
        ukDesc: 'Ремонти та оздоблення квартир у Катовіцах. Безкоштовна консультація. Instagram: remontiago.',
        enDesc: 'Apartment renovations and finishing in Katowice. Free consultation. Instagram: remontiago.',
        ruDesc: 'Ремонт и отделка квартир в Катовице. Бесплатная консультация. Instagram: remontiago.',
        tags: ['finishing', 'painting', 'tiles', 'repair'],
        languages: ['pl', 'uk'],
        socials: { instagram: 'https://instagram.com/remontiago' },
        locations: [
            { city: 'Katowice', street: null, voivodeship: 'slaskie', latitude: 50.2649, longitude: 19.0238, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 570 182 180' },
        ],
    });

    // 45. KOPA POLSKA - Олег Ковальчук
    await seedService({
        name: 'Kopa Polska',
        slug: 'kopa-polska',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Firma remontowo-budowlana. Remonty mieszkań, prace murarskie, elewacje, prace wykończeniowe. Gwarancja 1 rok. Katowice i okolice.',
        ukDesc: 'Ремонтно-будівельна фірма. Ремонт квартир, мурарські роботи, фасади, оздоблювальні роботи. Гарантія 1 рік. Катовіце та околиці.',
        enDesc: 'Construction and renovation company. Apartment renovations, masonry, facades, finishing works. 1 year guarantee. Katowice and surroundings.',
        ruDesc: 'Ремонтно-строительная фирма. Ремонт квартир, каменные работы, фасады, отделочные работы. Гарантия 1 год. Катовице и окрестности.',
        tags: ['finishing', 'painting', 'repair'],
        languages: ['pl', 'uk'],
        webpage: 'https://kopapolska.pl/',
        locations: [
            { city: 'Katowice', street: null, voivodeship: 'slaskie', latitude: 50.2649, longitude: 19.0238, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 727 803 272' },
        ],
    });

    // --- SZCZECIN ---

    // 46. Remont mieszkań i biur - Szczecin (881 210 928)
    await seedService({
        name: 'Remont Szczecin 881',
        slug: 'remont-szczecin-881',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Remonty mieszkań i biur, wykończenia wnętrz. Szczecin.',
        ukDesc: 'Ремонт квартир та офісів, внутрішнє оздоблення. Щецін.',
        enDesc: 'Apartment and office renovations, interior finishing. Szczecin.',
        ruDesc: 'Ремонт квартир и офисов, внутренняя отделка. Щецин.',
        tags: ['finishing', 'painting', 'repair'],
        languages: ['pl', 'uk', 'ru'],
        locations: [
            { city: 'Szczecin', street: null, voivodeship: 'zachodniopomorskie', latitude: 53.4285, longitude: 14.5528, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 881 210 928' },
        ],
    });

    // 47. Remonty wszystkiego rodzaju - Szczecin (duo)
    await seedService({
        name: 'Remonty Szczecin Duo',
        slug: 'remonty-szczecin-duo',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Remonty wszystkiego rodzaju. Szczecin. Dwa numery kontaktowe.',
        ukDesc: 'Ремонти всіх видів. Щецін. Два контактних номери.',
        enDesc: 'All types of renovations. Szczecin. Two contact numbers.',
        ruDesc: 'Ремонты всех видов. Щецин. Два контактных номера.',
        tags: ['finishing', 'painting', 'tiles', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Szczecin', street: null, voivodeship: 'zachodniopomorskie', latitude: 53.4285, longitude: 14.5528, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 534 690 296' },
        ],
    });

    // 48. Majstry universaly - Szczecin
    await seedService({
        name: 'Majstry Universaly Szczecin',
        slug: 'majstry-universaly-szczecin',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Ekipa remontowa — majstrowie uniwersalni. Szczecin.',
        ukDesc: 'Ремонтна бригада — майстри універсали. Щецін.',
        enDesc: 'Renovation crew — universal craftsmen. Szczecin.',
        ruDesc: 'Ремонтная бригада — мастера универсалы. Щецин.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Szczecin', street: null, voivodeship: 'zachodniopomorskie', latitude: 53.4285, longitude: 14.5528, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 49. Remont domów i mieszkań - Szczecin (793 464 671)
    await seedService({
        name: 'Remont Szczecin 793',
        slug: 'remont-szczecin-793',
        category: 'renovation',
        image: 'remont4.png',
        plDesc: 'Remonty domów i mieszkań. Doświadczenie w branży. Szczecin.',
        ukDesc: 'Ремонт будинків та квартир. Досвід у галузі. Щецін.',
        enDesc: 'House and apartment renovations. Industry experience. Szczecin.',
        ruDesc: 'Ремонт домов и квартир. Опыт в отрасли. Щецин.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Szczecin', street: null, voivodeship: 'zachodniopomorskie', latitude: 53.4285, longitude: 14.5528, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 793 464 671' },
        ],
    });

    // 50. Remonty mieszkań - Szczecin (601 654 288)
    await seedService({
        name: 'Remont Szczecin 601',
        slug: 'remont-szczecin-601',
        category: 'renovation',
        image: 'remont5.png',
        plDesc: 'Remonty mieszkań w Szczecinie.',
        ukDesc: 'Ремонт квартир у Щеціні.',
        enDesc: 'Apartment renovations in Szczecin.',
        ruDesc: 'Ремонт квартир в Щецине.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Szczecin', street: null, voivodeship: 'zachodniopomorskie', latitude: 53.4285, longitude: 14.5528, openingHours: standardShopHours, isMainLocation: true, phoneNumber: '+48 601 654 288' },
        ],
    });

    // --- LUBLIN ---

    // 51. Remont mieszkań Lublin (z ukraińskojęzycznego postu)
    await seedService({
        name: 'Remont Mieszkań Lublin UA',
        slug: 'remont-mieszkan-lublin-ua',
        category: 'renovation',
        image: 'remont1.png',
        plDesc: 'Remonty mieszkań w Lublinie. Ekipa ukraińskojęzyczna.',
        ukDesc: 'Ремонт квартир у Любліні. Україномовна бригада.',
        enDesc: 'Apartment renovations in Lublin. Ukrainian-speaking crew.',
        ruDesc: 'Ремонт квартир в Люблине. Украиноязычная бригада.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Lublin', street: null, voivodeship: 'lubelskie', latitude: 51.2465, longitude: 22.5684, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 52. Usługi remontowo-naprawcze Lublin
    await seedService({
        name: 'Usługi Remontowe Lublin',
        slug: 'uslugi-remontowe-lublin',
        category: 'renovation',
        image: 'remont2.png',
        plDesc: 'Usługi remontowo-naprawcze na terenie Lublina i okolic.',
        ukDesc: 'Ремонтні послуги на території Любліна та околиць.',
        enDesc: 'Renovation and repair services in Lublin and surroundings.',
        ruDesc: 'Ремонтные услуги на территории Люблина и окрестностей.',
        tags: ['finishing', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Lublin', street: null, voivodeship: 'lubelskie', latitude: 51.2465, longitude: 22.5684, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    // 53. Remonty, Wykończenia Wnętrz, Adaptacje - Lublin
    await seedService({
        name: 'Wykończenia Wnętrz Lublin',
        slug: 'wykonczenia-wnetrz-lublin',
        category: 'renovation',
        image: 'remont3.png',
        plDesc: 'Remonty, wykończenia wnętrz, adaptacje — kompleksowo. Lublin i okolice.',
        ukDesc: 'Ремонти, оздоблення інтер\'єрів, адаптації — комплексно. Люблін та околиці.',
        enDesc: 'Renovations, interior finishing, adaptations — comprehensive. Lublin and surroundings.',
        ruDesc: 'Ремонты, отделка интерьеров, адаптации — комплексно. Люблин и окрестности.',
        tags: ['finishing', 'painting', 'tiles', 'flooring', 'repair'],
        languages: ['pl', 'uk'],
        locations: [
            { city: 'Lublin', street: null, voivodeship: 'lubelskie', latitude: 51.2465, longitude: 22.5684, openingHours: standardShopHours, isMainLocation: true },
        ],
    });

    console.log('✅ Seed zakończony z tagami!');
}


mainSeed()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Błąd:', error);
        process.exit(1);
    });