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
        { key: 'bakery', pl: 'Piekarnia', uk: 'Пекарня' },
        { key: 'coffee', pl: 'Kawa', uk: 'Кава' },
        { key: 'grocery', pl: 'Spożywczy', uk: 'Продукти' },
        { key: 'imported', pl: 'Importowane', uk: 'Імпорт' },
        { key: 'alcohol', pl: 'Alkohol', uk: 'Алкоголь' },
        { key: 'atmosphere', pl: 'Atmosfera', uk: 'Атмосфера' },
        { key: 'beauty', pl: 'Uroda', uk: 'Краса' },
        { key: 'nails', pl: 'Paznokcie', uk: 'Манікюр' },
        { key: 'cider', pl: 'Cydr', uk: 'Сидр' },
        { key: 'streetfood', pl: 'Street Food', uk: 'Вулична їża' },
        { key: 'frozen', pl: 'Mrożonki', uk: 'Заморозка' },
        { key: 'handmade', pl: 'Ręczna robota', uk: 'Ручна робота' },
        { key: 'delivery', pl: 'Dostawa', uk: 'Доставка' },
        { key: 'logistics', pl: 'Logistyka', uk: 'Логістика' },
        { key: 'grill', pl: 'Grill', uk: 'Гриль' },
        { key: 'desserts', pl: 'Desery', uk: 'Десерти' },
        { key: 'barber', pl: 'Barber', uk: 'Барбер' },
        { key: 'haircare', pl: 'Włosy', uk: 'Волосся' },
        { key: 'health', pl: 'Zdrowie', uk: 'Здоров’я' },
        { key: 'doctor', pl: 'Lekarz', uk: 'Лікар' },
        { key: 'sushi', pl: 'Sushi', uk: 'Суші' },
        { key: 'seafood', pl: 'Owoce morza', uk: 'Морепродукти' },
        { key: 'chocolate', pl: 'Czekolada', uk: 'Шоколад' },
        { key: 'tradition', pl: 'Tradycja', uk: 'Традиції' },
        { key: 'home', pl: 'Domowe', uk: 'Домашнє' },
        { key: 'lunch', pl: 'Lunch', uk: 'Ланч' },
        { key: 'dumplings', pl: 'Pierogi', uk: 'Вареники' },
        { key: 'culture', pl: 'Kultura', uk: 'Культура' },
        { key: 'modern', pl: 'Nowoczesne', uk: 'Сучасне' },
        { key: 'legal', pl: 'Prawo', uk: 'Право' },
        { key: 'documents', pl: 'Dokumenty', uk: 'Документи' },
        { key: 'mechanic', pl: 'Mechanik', uk: 'Механік' },
        { key: 'repair', pl: 'Naprawa', uk: 'Ремонт' },
        { key: 'cargo', pl: 'Ładunki', uk: 'Вантажі' },
        { key: 'dentist', pl: 'Dentysta', uk: 'Стоматолог' },
        { key: 'ngo', pl: 'Organizacja pozarządowa', uk: 'Громадська організація' },
        { key: 'pediatrician', pl: 'Pediatra', uk: 'Педіатр' },
        { key: 'polish-courses', pl: 'Kursy polskiego', uk: 'Курси польської' },
    ];

    for (const t of tagsToCreate) {
        const [tag] = await db.insert(tagsTable).values({}).returning();
        await db.insert(tagsTranslationsTable).values([
            { tagId: tag.id, languageCode: 'pl', name: t.pl },
            { tagId: tag.id, languageCode: 'uk', name: t.uk }
        ]);
        tagMap[t.key] = tag.id;
    }

    // --- HELPER: SEEDER FUNCTION ---
    // To keep this readable and handle tags easily
    const slugCounter: Record<string, number> = {};

    async function seedService(data: {
        name: string, slug: string, category: any, webpage?: string,
        image?: string,
        plDesc: string, ukDesc: string,
        locations: any[],
        tags: string[],
        languages?: string[],
        socials?: any
    }) {
        let slug = data.slug;
        if (slugCounter[slug] !== undefined) {
            slugCounter[slug]++;
            slug = `${data.slug}-${slugCounter[slug]}`;
        } else {
            slugCounter[slug] = 0;
        }

        const [service] = await db.insert(servicesTable).values({
            name: data.name,
            slug,
            category: data.category,
            webpage: data.webpage,
            image: data.image,
            languages: data.languages || ['pl', 'uk'],
            socials: data.socials,
            status: 'active'
        }).returning();

        await db.insert(servicesTranslationsTable).values([
            { serviceId: service.id, languageCode: 'pl', name: data.name, description: data.plDesc },
            { serviceId: service.id, languageCode: 'uk', name: data.name, description: data.ukDesc }
        ]);

        await db.insert(serviceLocationsTable).values(
            data.locations.map(loc => ({ ...loc, serviceId: service.id }))
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
        tags: ['bakery', 'coffee'],
        image: 'lviv-croissants.png',
        locations: [
            { city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.2331, longitude: 21.0175, openingHours: standardGastroHours, isMainLocation: true },
            { city: 'Kraków', street: 'Grodzka 50', voivodeship: 'malopolskie', latitude: 50.0570, longitude: 19.9385, openingHours: standardGastroHours }
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
        tags: ['grocery', 'imported', 'alcohol', 'seafood'],
        image: 'best-market.png',
        webpage: 'https://best-market.pl/lokalizacje/',
        locations: [
            // WARSZAWA & OKOLICE
            { city: 'Warszawa', street: 'Al. Jerozolimskie 179 (Blue City)', voivodeship: 'mazowieckie', latitude: 52.2117, longitude: 20.9525, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Warszawa', street: 'ul. Tamka 40', voivodeship: 'mazowieckie', latitude: 52.2371, longitude: 21.0264, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Jana Pawła II 52/54', voivodeship: 'mazowieckie', latitude: 52.2425, longitude: 20.9936, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Grójecka 78', voivodeship: 'mazowieckie', latitude: 52.2155, longitude: 20.9785, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Światowida 17 (Galeria Północna)', voivodeship: 'mazowieckie', latitude: 52.3185, longitude: 20.9522, openingHours: standardShopHours },
            { city: 'Piaseczno', street: 'ul. Puławska 42E', voivodeship: 'mazowieckie', latitude: 52.0915, longitude: 21.0112, openingHours: standardShopHours },

            // KRAKÓW
            { city: 'Kraków', street: 'ul. Szlak 77 (Galeria Krakowska)', voivodeship: 'malopolskie', latitude: 50.0682, longitude: 19.9465, openingHours: standardShopHours },
            { city: 'Kraków', street: 'ul. Na Zjeździe 8', voivodeship: 'malopolskie', latitude: 50.0465, longitude: 19.9565, openingHours: standardShopHours },
            { city: 'Kraków', street: 'ul. Mogilska 120', voivodeship: 'malopolskie', latitude: 50.0691, longitude: 19.9791, openingHours: standardShopHours },

            // WROCŁAW
            { city: 'Wrocław', street: 'ul. Sieradzka 7', voivodeship: 'dolnoslaskie', latitude: 51.0915, longitude: 17.0392, openingHours: standardShopHours },
            { city: 'Wrocław', street: 'ul. Legnicka 58', voivodeship: 'dolnoslaskie', latitude: 51.1182, longitude: 16.9925, openingHours: standardShopHours },

            // POZOSTAŁE MIASTA
            { city: 'Poznań', street: 'ul. Półwiejska 42 (Stary Browar)', voivodeship: 'wielkopolskie', latitude: 52.4015, longitude: 16.9265, openingHours: standardShopHours },
            { city: 'Łódź', street: 'ul. Tuwima 14', voivodeship: 'lodzkie', latitude: 51.7658, longitude: 19.4608, openingHours: standardShopHours },
            { city: 'Gdańsk', street: 'ul. Rajska 10 (Madison)', voivodeship: 'pomorskie', latitude: 54.3551, longitude: 18.6472, openingHours: standardShopHours },
            { city: 'Gdynia', street: 'ul. Świętojańska 58', voivodeship: 'pomorskie', latitude: 54.5165, longitude: 18.5412, openingHours: standardShopHours },
            { city: 'Katowice', street: 'ul. Mickiewicza 4', voivodeship: 'slaskie', latitude: 50.2598, longitude: 19.0195, openingHours: standardShopHours },
            { city: 'Tychy', street: 'ul. Towarowa 2 (Gemini Park)', voivodeship: 'slaskie', latitude: 50.0965, longitude: 18.9912, openingHours: standardShopHours }
        ]
    });

    // 3
    await seedService({
        name: 'Piana Vyshnia', slug: 'piana-vyshnia', category: 'gastronomy',
        plDesc: 'Słynna lwowskia nalewka wiśniowa podawana w wyjątkowej atmosferze.',
        ukDesc: 'Знаменита львівська настоянка в унікальній атмосфері.',
        image: 'pijana-visnia.png',
        webpage: 'https://pianavyshnia.com/',
        tags: ['alcohol', 'atmosphere'],
        locations: [{ city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.2330, longitude: 21.0176, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 4
    await seedService({
        name: 'G.Bar',
        slug: 'g-bar-beauty',
        category: 'beauty',
        plDesc: 'Największa na świecie sieć barów beauty pochodząca z Ukrainy. Kompleksowe usługi: od manicure po profesjonalne makijaże i stylizacje włosów w wyjątkowej atmosferze.',
        ukDesc: 'Найбільша у світі мережа бʼюті-барів родом з України. Комплексні послуги: від манікюру до професійного макіяжу та укладок у винятковій атмосфері.',
        tags: ['beauty', 'nails', 'haircare', 'atmosphere'],
        webpage: 'https://gbar.com.pl/',
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
        tags: ['beauty', 'nails', 'haircare', 'modern'],
        webpage: 'https://fastlinestudio.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Jana Kazimierza 27', voivodeship: 'mazowieckie', latitude: 52.2215, longitude: 20.9385, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Kraków', street: 'ul. Pawia 9', voivodeship: 'malopolskie', latitude: 50.0685, longitude: 19.9455, openingHours: standardShopHours }
        ]
    });

    // 5
    await seedService({
        name: 'Bilyi Nalyv', slug: 'bilyi-nalyv', category: 'gastronomy',
        plDesc: 'Koncept one-euro-bar z cydrem i ostrygami.',
        ukDesc: 'Формат one-euro-bar: сидр, хот-доги та устриці.',
        tags: ['cider', 'streetfood'],
        locations: [{ city: 'Kraków', street: 'Bracka 4', voivodeship: 'malopolskie', latitude: 50.0608, longitude: 19.9372, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 6
// 6
    await seedService({
        name: 'Odessa Market',
        slug: 'odessa-market',
        category: 'grocery',
        plDesc: 'Sieć sklepów oferująca autentyczne produkty i smaki Wschodu – od Ukrainy po Gruzję i Armenię.',
        ukDesc: 'Мережа магазинів, що пропонує автентичні продукти та смаки Сходу – від України до Грузії та Вірменії.',
        tags: ['grocery', 'imported', 'frozen', 'tradition'],
        image: 'odessa-market.png',
        webpage: 'https://odessamarket.pl/',
        locations: [
            {
                city: 'Warszawa',
                street: 'ul. Jana Kazimierza 29',
                voivodeship: 'mazowieckie',
                latitude: 52.2215,
                longitude: 20.9388,
                openingHours: standardShopHours,
                isMainLocation: true
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

    // 7
    await seedService({
        name: 'ChiChi Koza', slug: 'chichi-koza', category: 'gastronomy',
        plDesc: 'Nowoczesna kuchnia ukraińska z naciskiem na domowe pierogi.',
        ukDesc: 'Сучасна українська кухня, особливий акцент на варениках.',
        tags: ['dumplings', 'modern'],
        locations: [{ city: 'Gdynia', street: 'Świętojańska 110', voivodeship: 'pomorskie', latitude: 54.5120, longitude: 18.5410, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 8
    await seedService({
        name: 'Multi Cook', slug: 'multi-cook-warszawa', category: 'grocery',
        plDesc: 'Sklep z rzemieślniczymi mrożonkami.',
        ukDesc: 'Магазин заморожених напівфабрикатів ручної роботи.',
        tags: ['frozen', 'handmade'],
        image: 'multicook.png',
        locations: [
            {
                city: 'Warszawa', street: 'ul. Jugosłowiańska 13', voivodeship: 'mazowieckie',
                latitude: 52.2285, longitude: 21.0965, openingHours: standardShopHours, isMainLocation: true
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
        ukDesc: 'Європейське відділення лідера української логістики. Пропонує швидку кур’єрську доставку, перевезення вантажів та документів між Польщею та Україною.',
        tags: ['logistics', 'delivery', 'documents'],
        image: 'nova-post.png',
        webpage: 'https://novapost.com/pl-pl/departments',
        locations: [
            // WARSZAWA (Główne oddziały)
            { city: 'Warszawa', street: 'ul. Męcińska 18', voivodeship: 'mazowieckie', latitude: 52.2355, longitude: 21.0825, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Warszawa', street: 'ul. Jana Pawła II 27', voivodeship: 'mazowieckie', latitude: 52.2370, longitude: 20.9985, openingHours: standardShopHours },
            { city: 'Warszawa', street: 'ul. Kaliskiego 15', voivodeship: 'mazowieckie', latitude: 52.2530, longitude: 20.8985, openingHours: standardShopHours },

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

    // 10
    await seedService({
        name: 'Rebernia', slug: 'rebernia-lodz', category: 'gastronomy',
        plDesc: 'Słynne grillowane żeberka według lwowskiej receptury.',
        ukDesc: 'Знамениті ребра на грилі за львівським рецептом.',
        tags: ['grill', 'atmosphere'],
        locations: [{ city: 'Łódź', street: 'Ogrodowa 17', voivodeship: 'lodzkie', latitude: 51.7788, longitude: 19.4485, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 11
    await seedService({
        name: 'Cukiernias', slug: 'cukiernias-warszawa', category: 'gastronomy',
        plDesc: 'Autentyczne ukraińskie wypieki i torty.',
        ukDesc: 'Автентична українська випічка та торти.',
        tags: ['bakery', 'desserts'],
        locations: [{ city: 'Warszawa', street: 'Chmielna 21', voivodeship: 'mazowieckie', latitude: 52.2325, longitude: 21.0145, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 15
    await seedService({
        name: 'Kanapka Bar', slug: 'kanapka-bar-warszawa', category: 'gastronomy',
        plDesc: 'Szybkie przekąski w lwowskim stylu.',
        ukDesc: 'Швидкі перекуски у львівському стилі.',
        tags: ['streetfood', 'atmosphere'],
        locations: [{ city: 'Warszawa', street: 'Koszykowa 63', voivodeship: 'mazowieckie', latitude: 52.2220, longitude: 21.0120, isMainLocation: true, openingHours: standardGastroHours }]
    });

// 16
    await seedService({
        name: 'Czarnomorka', slug: 'czarnomorka', category: 'gastronomy',
        plDesc: 'Restauracja rybna znana ze świeżych owoców morza.',
        ukDesc: 'Рибний ресторан, відомий свіжими морепродуктами.',
        tags: ['seafood', 'tradition'],
        locations: [{ city: 'Warszawa', street: 'Hoża 43/49', voivodeship: 'mazowieckie', latitude: 52.2269, longitude: 21.0118, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 17
    await seedService({
        name: 'Wesoła Pani', slug: 'wesola-pani', category: 'grocery',
        plDesc: 'Sklep oferujący mrożone domowe dania.',
        ukDesc: 'Магазин домашніх напівфабрикатів.',
        tags: ['frozen', 'home'],
        locations: [{ city: 'Warszawa', street: 'al. Jerozolimskie 148', voivodeship: 'mazowieckie', latitude: 52.2137, longitude: 20.9654, isMainLocation: true, openingHours: standardShopHours }]
    });


    // 19
    await seedService({
        name: 'Restauracja U sióstr', slug: 'u-siostr', category: 'gastronomy',
        plDesc: 'Tradycyjna kuchnia ukraińska w sercu Warszawy.',
        ukDesc: 'Традиційна українська кухня в центрі Варшави.',
        tags: ['tradition', 'home'],
        locations: [{ city: 'Warszawa', street: 'Złota 63A', voivodeship: 'mazowieckie', latitude: 52.2305, longitude: 21.0003, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 20
    await seedService({
        name: 'Kresowe Smaki Valentyny', slug: 'kresowe-smaki-valentyny', category: 'gastronomy',
        plDesc: 'Domowe smaki Kresów i Ukrainy.',
        ukDesc: 'Домашні страви за традиційними рецептами.',
        image: 'smaki-valentyny.png',
        webpage: 'https://kresowe-smaki-valentyny-sienna89.eatbu.com/',
        tags: ['home', 'tradition'],
        locations: [{ city: 'Warszawa', street: 'Sienna 89', voivodeship: 'mazowieckie', latitude: 52.2302, longitude: 20.9934, isMainLocation: true, openingHours: standardGastroHours }]
    });



    // 22
    await seedService({
        name: 'Kamanda Lwowska', slug: 'kamanda-lwowska', category: 'gastronomy',
        plDesc: 'Restauracja nawiązująca do przedwojennego klimatu Lwowa.',
        ukDesc: 'Ресторан, що відтворює атмосферу довоєнного Львова.',
        tags: ['atmosphere', 'culture'],
        locations: [{ city: 'Warszawa', street: 'Foksal 10', voivodeship: 'mazowieckie', latitude: 52.2335, longitude: 21.0219, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 23
    await seedService({
        name: 'Kozaczok', slug: 'kozaczok', category: 'gastronomy',
        plDesc: 'Ukraiński punkt gastronomiczny.',
        ukDesc: 'Українська кухня у торговому центрі.',
        webpage: 'https://kozaczok.eatbu.com/',
        tags: ['lunch', 'dumplings'],
        locations: [
            { city: 'Warszawa', street: 'ul.Sokratesa 9', voivodeship: 'mazowieckie', latitude: 52.2839, longitude: 20.92699, isMainLocation: true, openingHours: standardGastroHours },
            { city: 'Warszawa', street: 'C.H. Arkadia al. Jana Pawła II 82', voivodeship: 'mazowieckie', latitude: 52.25659, longitude: 20.98429, isMainLocation: true, openingHours: standardGastroHours }
    ]
    });

    // 24
    await seedService({
        name: 'Dikańka', slug: 'dikanka', category: 'gastronomy',
        plDesc: 'Tradycyjne potrawy ukraińskie w przytulnym wnętrzu.',
        ukDesc: 'Традиційні українські страви у затишному інтер’єрі.',
        tags: ['tradition', 'atmosphere'],
        locations: [{ city: 'Warszawa', street: 'Olesińska 2', voivodeship: 'mazowieckie', latitude: 52.2044, longitude: 21.0217, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 25
    await seedService({
        name: 'W Kuchni', slug: 'w-kuchni-bar-kuchnia-ukrainska', category: 'gastronomy',
        plDesc: 'Domowe jedzenie ukraińskie dostępne w drodze.',
        ukDesc: 'Домашня українська їжа, зручно по дорозі.',
        tags: ['home', 'streetfood'],
        locations: [{ city: 'Warszawa', street: 'Al. Jerozolimskie 54', voivodeship: 'mazowieckie', latitude: 52.2289, longitude: 21.0062, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 26
    await seedService({
        name: 'Bistro Kozacka Chatka', slug: 'bistro-kozacka-chatka', category: 'gastronomy',
        plDesc: 'Kultowe miejsce we Wrocławiu.',
        ukDesc: 'Культове місце у Вроцлаві.',
        tags: ['tradition', 'culture'],
        locations: [{ city: 'Wrocław', street: 'Energetyczna 14/1b', voivodeship: 'dolnoslaskie', latitude: 51.0913, longitude: 17.0204, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 27
    await seedService({
        name: 'Smak Ukraiński', slug: 'smak-ukrainski-krakow', category: 'gastronomy',
        plDesc: 'Klasyki kuchni ukraińskiej.',
        ukDesc: 'Класичні українські страви.',
        tags: ['tradition', 'lunch'],
        locations: [{ city: 'Kraków', street: 'Grodzka 21', voivodeship: 'malopolskie', latitude: 50.0594, longitude: 19.9381, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 28
    await seedService({
        name: 'Pan Kotowski', slug: 'pan-kotowski-gdansk', category: 'gastronomy',
        plDesc: 'Kawiarnia i pierogarnia w Gdańsku.',
        ukDesc: 'Кафе та варенична у Гданську.',
        image: 'pan-kotowski.png',
        tags: ['coffee', 'dumplings'],
        locations: [{ city: 'Gdańsk', street: 'Ogarna 11/12', voivodeship: 'pomorskie', latitude: 54.3481, longitude: 18.6508, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 29
    await seedService({
        name: 'Ukraineczka', slug: 'ukraineczka-szczecin', category: 'gastronomy',
        plDesc: 'Szczecińska restauracja z bogatym menu.',
        ukDesc: 'Ресторан у Щецині з багатим меню.',
        tags: ['culture', 'home'],
        locations: [{ city: 'Szczecin', street: 'Panieńska 19', voivodeship: 'zachodniopomorskie', latitude: 53.4249, longitude: 14.5599, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 30
    await seedService({
        name: 'Restauracja Dumka', slug: 'restauracja-dumka-kielce', category: 'gastronomy',
        plDesc: 'Miejsce spotkań z ukraińską kulturą.',
        ukDesc: 'Місце зустрічі з українською культурою.',
        webpage: 'https://www.dumkarest.pl/',
        image: 'dumka.png',
        tags: ['culture', 'atmosphere'],
        locations: [{ city: 'Chełm', street: 'Lubelska 17/1', voivodeship: 'lubelskie', latitude: 51.1322, longitude: 23.47611, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 31
    await seedService({
        name: 'Kulinarna Ukraina', slug: 'kulinarna-ukraina-gdynia', category: 'gastronomy',
        plDesc: 'Prawdziwe smaki Ukrainy nad morzem.',
        ukDesc: 'Справжні смаки України над морем.',
        tags: ['seafood', 'home'],
        locations: [{ city: 'Gdynia', street: 'Świętojańska 66', voivodeship: 'pomorskie', latitude: 54.5165, longitude: 18.5391, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 32
    await seedService({
        name: 'Koronkowa Robota', slug: 'koronkowa-robota-plock', category: 'gastronomy',
        plDesc: 'Autorska kuchnia łącząca tradycję z nowoczesnością.',
        ukDesc: 'Авторська кухня та сучасність.',
        tags: ['modern', 'tradition'],
        locations: [{ city: 'Płock', street: 'Fryderyka Chopina 28', voivodeship: 'mazowieckie', latitude: 52.5501, longitude: 19.6972, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // DODAC KOSCIOLY PRAWOSLAWNE

    // 33
    await seedService({
        name: 'Willa Biała', slug: 'willa-biala-warszawa', category: 'gastronomy',
        plDesc: 'Elegancka restauracja w zabytkowej willi.',
        ukDesc: 'Елегантний ресторан у старій віллі.',
        tags: ['atmosphere', 'modern'],
        locations: [{ city: 'Warszawa', street: 'Narbutta 10', voivodeship: 'mazowieckie', latitude: 52.2091, longitude: 21.0189, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 36
    await seedService({
        name: 'Serwis UA', slug: 'auto-serwis-ua', category: 'mechanics',
        plDesc: 'Profesjonalny serwis samochodowy.',
        ukDesc: 'Професійне обслуговування авто.',
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
        ukDesc: 'Мережа магазинів, що пропонує традиційні смаки зі Сходу. Спеціалізується на автентичних м’ясних виробах, рибі, солодощах та делікатесах з України, Литви та Грузії.',
        tags: ['grocery', 'imported', 'alcohol', 'seafood'],
        image: 'ukrainooczka.png',
        webpage: 'https://ukrainoczka.pl/nasze-lokalizacje/',
        locations: [
            // WARSZAWA
            { city: 'Warszawa', street: 'ul. Posag 7 Panien 11', voivodeship: 'mazowieckie', latitude: 52.2035, longitude: 20.8955, openingHours: standardShopHours, isMainLocation: true },
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
        tags: ['polish-courses', 'ngo'],
        webpage: 'https://ocalenie.org.pl/polski-dla-cudzoziemcow',
        locations: [
            { city: 'Warszawa', street: 'ul. Krucza 6/14a', voivodeship: 'mazowieckie', latitude: 52.2315, longitude: 21.0185, openingHours: standardShopHours, isMainLocation: true }
        ]
    });

    // --- 10. MEDYCYNA I ZDROWIE (Kategoria: health) ---


    // Twój Lekarz w Warszawie (Przychodnia ukraińska)
    await seedService({
        name: 'Twój Lekarz w Warszawie',
        slug: 'twoj-lekarz-warszawa',
        category: 'health',
        plDesc: 'Prywatna przychodnia medyczna założona z myślą o pacjentach ukraińskojęzycznych. Kompleksowa opieka: od internisty po ginekologa.',
        ukDesc: 'Приватна медична клініка, створена для україномовних пацієнтів. Комплексна допомога: від терапевta до гінеколога.',
        tags: ['health', 'doctor', 'pediatrician'],
        webpage: 'https://twojlekarzwwarszawie.pl/',
        locations: [
            { city: 'Warszawa', street: 'ul. Jana Kazimierza 21A', voivodeship: 'mazowieckie', latitude: 52.2235, longitude: 20.9395, openingHours: standardShopHours, isMainLocation: true }
        ]
    });

    // Accounting & Tax - Spółki i JDG
    await seedService({
        name: 'Progress Holding - Księgowość i Finanse',
        slug: 'progress-holding',
        category: 'financial',
        plDesc: 'Biuro rachunkowe specjalizujące się w obsłudze ukraińskiego biznesu w Polsce. Doradztwo podatkowe, optymalizacja i zakładanie spółek.',
        ukDesc: 'Бухгалтерія, що спеціалізується на обслуговуванні українського бізнесу в Польщі. Податкові консультації, оптимізація та реєстрація компаній.',
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
        tags: ['ngo', 'culture', 'atmosphere'],
        webpage: 'https://www.facebook.com/teatrnavpaky/',
        locations: [
            { city: 'Gdynia', street: 'ul. Bema 26 (Konsulat Kultury)', voivodeship: 'pomorskie', latitude: 54.5165, longitude: 18.5385, openingHours: standardShopHours, isMainLocation: true },
            { city: 'Gdańsk', street: 'ul. Grunwaldzka 199', voivodeship: 'pomorskie', latitude: 54.3895, longitude: 18.5945, openingHours: standardShopHours }
        ]
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