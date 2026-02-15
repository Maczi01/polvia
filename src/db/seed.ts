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
    async function seedService(data: {
        name: string, slug: string, category: any, webpage?: string,
        plDesc: string, ukDesc: string,
        locations: any[],
        tags: string[],
        languages?: string[],
        socials?: any
    }) {
        const [service] = await db.insert(servicesTable).values({
            name: data.name,
            slug: data.slug,
            category: data.category,
            webpage: data.webpage,
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
        locations: [
            { city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.2331, longitude: 21.0175, openingHours: standardGastroHours, isMainLocation: true },
            { city: 'Kraków', street: 'Grodzka 50', voivodeship: 'malopolskie', latitude: 50.0570, longitude: 19.9385, openingHours: standardGastroHours }
        ]
    });

    // 2
    await seedService({
        name: 'Best Market', slug: 'best-market', category: 'grocery',
        plDesc: 'Sieć sklepów z produktami z Ukrainy i całego świata.',
        ukDesc: 'Мережа магазинів з продуктами з України та всього світу.',
        tags: ['grocery', 'imported'],
        locations: [{ city: 'Wrocław', street: 'Siebińska 2', voivodeship: 'dolnoslaskie', latitude: 51.0930, longitude: 17.0550, openingHours: standardShopHours, isMainLocation: true }]
    });

    // 3
    await seedService({
        name: 'Piana Vyshnia', slug: 'piana-vyshnia', category: 'gastronomy',
        plDesc: 'Słynna lwowskia nalewka wiśniowa podawana w wyjątkowej atmosferze.',
        ukDesc: 'Знаменита львівська настоянка в унікальній атмосфері.',
        tags: ['alcohol', 'atmosphere'],
        locations: [{ city: 'Warszawa', street: 'Nowy Świat 37', voivodeship: 'mazowieckie', latitude: 52.2330, longitude: 21.0176, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 4
    await seedService({
        name: 'G.Bar', slug: 'g-bar', category: 'beauty',
        plDesc: 'Nowoczesny salon beauty oferujący usługi makijażu, fryzjerskie i manicure.',
        ukDesc: 'Сучасний б’юті-бар: макіяж, укладка та манікюр.',
        tags: ['beauty', 'nails'],
        locations: [{ city: 'Warszawa', street: 'Mokotowska 49', voivodeship: 'mazowieckie', latitude: 52.2241, longitude: 21.0210, isMainLocation: true, openingHours: standardShopHours }]
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
    await seedService({
        name: 'Odessa Market', slug: 'odessa-market', category: 'grocery',
        plDesc: 'Sklep z autentyczną żywnością wschodnią.',
        ukDesc: 'Магазин автентичних східних продуктів.',
        tags: ['grocery', 'imported'],
        locations: [{ city: 'Warszawa', street: 'Chmielna 26', voivodeship: 'mazowieckie', latitude: 52.2320, longitude: 21.0150, isMainLocation: true, openingHours: standardShopHours }]
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
        locations: [{ city: 'Warszawa', street: 'Al. Jerozolimskie 155', voivodeship: 'mazowieckie', latitude: 52.2150, longitude: 20.9580, isMainLocation: true, openingHours: standardShopHours }]
    });

    // 9
    await seedService({
        name: 'Nova Post', slug: 'nova-post-polska', category: 'others',
        plDesc: 'Szybkie przesyłki kurierskie Polska-Ukraina.',
        ukDesc: 'Швидка доставка посилок між Польщею та Україною.',
        tags: ['delivery', 'logistics'],
        locations: [{ city: 'Warszawa', street: 'Męcińska 18', voivodeship: 'mazowieckie', latitude: 52.2420, longitude: 21.0820, isMainLocation: true, openingHours: standardShopHours }]
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

    // 12
    await seedService({
        name: 'Hairdryer Barber', slug: 'hairdryer-barber-krakow', category: 'beauty',
        plDesc: 'Profesjonalne usługi fryzjerskie i barberingowe.',
        ukDesc: 'Професійні послуги перукаря та барбера.',
        tags: ['barber', 'haircare'],
        locations: [{ city: 'Kraków', street: 'Pawia 12', voivodeship: 'malopolskie', latitude: 50.0670, longitude: 19.9450, isMainLocation: true, openingHours: standardShopHours }]
    });

    // 13
    await seedService({
        name: 'Centrum Medyczne Dobro', slug: 'centrum-medyczne-dobro', category: 'health',
        plDesc: 'Opieka medyczna z ukraińskojęzycznym personelem.',
        ukDesc: 'Медична допомога з україномовним персоналом.',
        tags: ['health', 'doctor'],
        locations: [{ city: 'Warszawa', street: 'Grzybowska 4', voivodeship: 'mazowieckie', latitude: 52.2360, longitude: 21.0010, isMainLocation: true, openingHours: standardShopHours }]
    });

    // 14
    await seedService({
        name: 'Sushi Master', slug: 'sushi-master-wroclaw', category: 'gastronomy',
        plDesc: 'Popularna sieć sushi.',
        ukDesc: 'Популярна мережа суші.',
        tags: ['sushi', 'delivery'],
        locations: [{ city: 'Wrocław', street: 'Tęczowa 83', voivodeship: 'dolnoslaskie', latitude: 51.1020, longitude: 17.0150, isMainLocation: true, openingHours: standardGastroHours }]
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
        locations: [{ city: 'Warszawa', street: 'Hoża 43/49', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 17
    await seedService({
        name: 'Wesoła Pani', slug: 'wesola-pani', category: 'grocery',
        plDesc: 'Sklep oferujący mrożone domowe dania.',
        ukDesc: 'Магазин домашніх напівфабрикатів.',
        tags: ['frozen', 'home'],
        locations: [{ city: 'Warszawa', street: 'al. Jerozolimskie 148', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardShopHours }]
    });

    // 18
    await seedService({
        name: 'Krakowska Manufaktura Czekolady', slug: 'krakowska-manufaktura-czekolady', category: 'gastronomy',
        plDesc: 'Ręcznie robione czekoladki inspirowane lwowską tradycją.',
        ukDesc: 'Шоколад ручної роботи за львівськими традиціями.',
        tags: ['chocolate', 'handmade'],
        locations: [{ city: 'Kraków', street: 'Szewska 7', voivodeship: 'malopolskie', latitude: cityCoords.Kraków.lat, longitude: cityCoords.Kraków.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 19
    await seedService({
        name: 'Restauracja U sióstr', slug: 'u-siostr', category: 'gastronomy',
        plDesc: 'Tradycyjna kuchnia ukraińska w sercu Warszawy.',
        ukDesc: 'Традиційна українська кухня в центрі Варшави.',
        tags: ['tradition', 'home'],
        locations: [{ city: 'Warszawa', street: 'Złota 63A', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 20
    await seedService({
        name: 'Kresowe Smaki Valentyny', slug: 'kresowe-smaki-valentyny', category: 'gastronomy',
        plDesc: 'Domowe smaki Kresów i Ukrainy.',
        ukDesc: 'Домашні страви за традиційними рецептами.',
        tags: ['home', 'tradition'],
        locations: [{ city: 'Warszawa', street: 'Siena 89', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 21
    await seedService({
        name: 'Bistro Wyszywanka', slug: 'bistro-wyszywanka', category: 'gastronomy',
        plDesc: 'Szybkie i smaczne dania kuchni ukraińskiej.',
        ukDesc: 'Швидкі та смачні страви української кухні.',
        tags: ['lunch', 'streetfood'],
        locations: [{ city: 'Warszawa', street: 'Targowa 72', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 22
    await seedService({
        name: 'Kamanda Lwowska', slug: 'kamanda-lwowska', category: 'gastronomy',
        plDesc: 'Restauracja nawiązująca do przedwojennego klimatu Lwowa.',
        ukDesc: 'Ресторан, що відтворює атмосферу довоєнного Львова.',
        tags: ['atmosphere', 'culture'],
        locations: [{ city: 'Warszawa', street: 'Foksala 10', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 23
    await seedService({
        name: 'Kozaczok', slug: 'kozaczok', category: 'gastronomy',
        plDesc: 'Ukraiński punkt gastronomiczny.',
        ukDesc: 'Українська кухня у торговому центрі.',
        tags: ['lunch', 'dumplings'],
        locations: [{ city: 'Warszawa', street: 'al. Jana Pawła II 82', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 24
    await seedService({
        name: 'Dikańka', slug: 'dikanka', category: 'gastronomy',
        plDesc: 'Tradycyjne potrawy ukraińskie w przytulnym wnętrzu.',
        ukDesc: 'Традиційні українські страви у затишному інтер’єрі.',
        tags: ['tradition', 'atmosphere'],
        locations: [{ city: 'Warszawa', street: 'Olesińska 2', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 25
    await seedService({
        name: 'W Kuchni', slug: 'w-kuchni-bar-kuchnia-ukrainska', category: 'gastronomy',
        plDesc: 'Domowe jedzenie ukraińskie dostępne w drodze.',
        ukDesc: 'Домашня українська їжа, зручно по дорозі.',
        tags: ['home', 'streetfood'],
        locations: [{ city: 'Warszawa', street: 'Przejście podziemne Jerozolimskie', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 26
    await seedService({
        name: 'Bistro Kozacka Chatka', slug: 'bistro-kozacka-chatka', category: 'gastronomy',
        plDesc: 'Kultowe miejsce we Wrocławiu.',
        ukDesc: 'Культове місце у Вроцлаві.',
        tags: ['tradition', 'culture'],
        locations: [{ city: 'Wrocław', street: 'Energetyczna 14/1b', voivodeship: 'dolnoslaskie', latitude: cityCoords.Wrocław.lat, longitude: cityCoords.Wrocław.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 27
    await seedService({
        name: 'Smak Ukraiński', slug: 'smak-ukrainski-krakow', category: 'gastronomy',
        plDesc: 'Klasyki kuchni ukraińskiej.',
        ukDesc: 'Класичні українські страви.',
        tags: ['tradition', 'lunch'],
        locations: [{ city: 'Kraków', street: 'Grodzka 21', voivodeship: 'malopolskie', latitude: cityCoords.Kraków.lat, longitude: cityCoords.Kraków.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 28
    await seedService({
        name: 'Pan Kotowski', slug: 'pan-kotowski-gdansk', category: 'gastronomy',
        plDesc: 'Kawiarnia i pierogarnia w Gdańsku.',
        ukDesc: 'Кафе та варенична у Гданську.',
        tags: ['coffee', 'dumplings'],
        locations: [{ city: 'Gdańsk', street: 'Ogarna 11/12', voivodeship: 'pomorskie', latitude: cityCoords.Gdańsk.lat, longitude: cityCoords.Gdańsk.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 29
    await seedService({
        name: 'Ukraineczka', slug: 'ukraineczka-szczecin', category: 'gastronomy',
        plDesc: 'Szczecińska restauracja z bogatym menu.',
        ukDesc: 'Ресторан у Щецині з багатим меню.',
        tags: ['culture', 'home'],
        locations: [{ city: 'Szczecin', street: 'Panieńska 19', voivodeship: 'zachodniopomorskie', latitude: cityCoords.Szczecin.lat, longitude: cityCoords.Szczecin.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 30
    await seedService({
        name: 'Restauracja Dumka', slug: 'restauracja-dumka-kielce', category: 'gastronomy',
        plDesc: 'Miejsce spotkań z ukraińską kulturą.',
        ukDesc: 'Місце зустрічі з українською культурою.',
        tags: ['culture', 'atmosphere'],
        locations: [{ city: 'Kielce', street: 'Paderewskiego 34/3', voivodeship: 'swietokrzyskie', latitude: cityCoords.Kielce.lat, longitude: cityCoords.Kielce.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 31
    await seedService({
        name: 'Kulinarna Ukraina', slug: 'kulinarna-ukraina-gdynia', category: 'gastronomy',
        plDesc: 'Prawdziwe smaki Ukrainy nad morzem.',
        ukDesc: 'Справжні смаки України над морем.',
        tags: ['seafood', 'home'],
        locations: [{ city: 'Gdynia', street: 'Świętojańska 66', voivodeship: 'pomorskie', latitude: cityCoords.Gdynia.lat, longitude: cityCoords.Gdynia.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 32
    await seedService({
        name: 'Koronkowa Robota', slug: 'koronkowa-robota-plock', category: 'gastronomy',
        plDesc: 'Autorska kuchnia łącząca tradycję z nowoczesnością.',
        ukDesc: 'Авторська кухня та сучасність.',
        tags: ['modern', 'tradition'],
        locations: [{ city: 'Płock', street: 'Fryderyka Chopina 28', voivodeship: 'mazowieckie', latitude: cityCoords.Płock.lat, longitude: cityCoords.Płock.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 33
    await seedService({
        name: 'Willa Biała', slug: 'willa-biala-warszawa', category: 'gastronomy',
        plDesc: 'Elegancka restauracja w zabytkowej willi.',
        ukDesc: 'Елегантний ресторан у старій віллі.',
        tags: ['atmosphere', 'modern'],
        locations: [{ city: 'Warszawa', street: 'Narbutta 10', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 34
    await seedService({
        name: 'Ukraińskie Smaki', slug: 'ukrainskie-smaki-poznan', category: 'gastronomy',
        plDesc: 'Tradycyjna kuchnia ukraińska.',
        ukDesc: 'Традиційна українська кухня.',
        tags: ['tradition', 'home'],
        locations: [{ city: 'Poznań', street: 'Półwiejska 17', voivodeship: 'wielkopolskie', latitude: cityCoords.Poznań.lat, longitude: cityCoords.Poznań.lon, isMainLocation: true, openingHours: standardGastroHours }]
    });

    // 35
    await seedService({
        name: 'Kancelaria Vartal', slug: 'kancelaria-vartal', category: 'law',
        plDesc: 'Pomoc prawna i legalizacja pobytu.',
        ukDesc: 'Юридична допомога та легалізація перебування.',
        tags: ['legal', 'documents'],
        locations: [{ city: 'Warszawa', street: 'Al. Jerozolimskie 81', voivodeship: 'mazowieckie', latitude: cityCoords.Warszawa.lat, longitude: cityCoords.Warszawa.lon, isMainLocation: true, openingHours: standardShopHours }]
    });

    // 36
    await seedService({
        name: 'Auto Serwis UA', slug: 'auto-serwis-ua', category: 'mechanics',
        plDesc: 'Profesjonalny serwis samochodowy.',
        ukDesc: 'Професійне обслуговування авто.',
        tags: ['mechanic', 'repair'],
        locations: [{ city: 'Wrocław', street: 'Krakowska 141', voivodeship: 'dolnoslaskie', latitude: cityCoords.Wrocław.lat, longitude: cityCoords.Wrocław.lon, isMainLocation: true, openingHours: standardShopHours }]
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