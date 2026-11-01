import type { OpeningHours } from '@/lib/weekdays';

import type {
    PremiumContent,
    PremiumProfileView,
    ProfileImage,
    ProfileLocation,
    ServiceProfileView,
    SimilarService,
} from './service-profile-types';

/**
 * Fikcyjne wpisy do testow i Storybooka. Obrazy to istniejace pliki z `public/`
 * (zastepcze — kierunek wizualny, nie tresc firmy).
 */

const WEEKDAY_HOURS: OpeningHours = {
    monday: { open: '08:00', close: '18:00' },
    tuesday: { open: '08:00', close: '18:00' },
    wednesday: { open: '08:00', close: '18:00' },
    thursday: { open: '08:00', close: '18:00' },
    friday: { open: '08:00', close: '16:00' },
    saturday: { open: '09:00', close: '13:00' },
};

export function makeLocation(overrides: Partial<ProfileLocation> = {}): ProfileLocation {
    return {
        id: 'loc-main',
        city: 'Warszawa',
        street: 'ul. Grochowska 278',
        postcode: '03-841',
        voivodeship: 'mazowieckie',
        latitude: 52.2481,
        longitude: 21.0927,
        phoneNumber: '+48 600 100 200',
        email: 'biuro@mistrzremontu.pl',
        webpage: 'www.mistrzremontu.pl',
        socials: {
            facebook: 'https://facebook.com/mistrzremontu',
            instagram: 'https://instagram.com/mistrzremontu',
            tiktok: 'https://tiktok.com/@mistrzremontu',
            telegram: 'https://t.me/mistrzremontu',
        },
        whatsappNumber: '+48 600 100 200',
        openingHours: WEEKDAY_HOURS,
        isMainLocation: true,
        ...overrides,
    };
}

const SIMILAR_SERVICES: SimilarService[] = [
    {
        slug: 'liga-remontu',
        name: 'Liga Remontu',
        logo: '/services/remont3.png',
        city: 'Warszawa',
        category: 'renovation',
        href: { pathname: '/map', query: { place: 'liga-remontu' } },
    },
    {
        slug: 'ekipa-wykonczenia',
        name: 'Ekipa Wykończenia',
        logo: null,
        city: 'Piaseczno',
        category: 'renovation',
        href: { pathname: '/map', query: { place: 'ekipa-wykonczenia' } },
    },
    {
        slug: 'dom-pod-klucz',
        name: 'Dom pod Klucz Serhii',
        logo: '/services/remont4.png',
        city: 'Pruszków',
        category: 'renovation',
        href: { pathname: '/map', query: { place: 'dom-pod-klucz' } },
    },
    {
        slug: 'glazurnik-kyiv',
        name: 'Glazurnik z Kijowa',
        logo: '/services/remont5.png',
        city: 'Warszawa',
        category: 'renovation',
        href: { pathname: '/map', query: { place: 'glazurnik-kyiv' } },
    },
];

export const localServiceFixture: ServiceProfileView = {
    serviceId: '6f1c2a9e-3b7d-4c55-9a10-2f4e8d7b1c01',
    slug: 'mistrz-remontu',
    name: 'Mistrz Remontu',
    description:
        'Kompleksowe remonty mieszkań i domów w Warszawie i okolicach. Od projektu, przez instalacje, po ostatnią warstwę farby.\n\nPracujemy w ekipie z Polski i Ukrainy, rozmawiamy po polsku, ukraińsku i rosyjsku. Dajemy pisemną gwarancję na wszystkie prace.',
    logo: '/services/remontyhlu.png',
    category: 'renovation',
    coverage: 'local',
    languages: ['pl', 'uk', 'ru'],
    tags: ['Remont mieszkań', 'Łazienki', 'Glazura', 'Malowanie', 'Instalacje elektryczne'],
    verified: true,
    locations: [
        makeLocation(),
        makeLocation({
            id: 'loc-branch',
            city: 'Piaseczno',
            street: 'ul. Puławska 42',
            postcode: '05-500',
            latitude: 52.0814,
            longitude: 21.0239,
            phoneNumber: '+48 600 300 400',
            email: null,
            isMainLocation: false,
        }),
    ],
    mapHref: { pathname: '/map', query: { place: 'mistrz-remontu' } },
    similarServices: SIMILAR_SERVICES,
    premium: null,
};

export const onlineServiceFixture: ServiceProfileView = {
    serviceId: '0b9d3e47-8a26-4f1e-b5c3-7d2a6e9f4b02',
    slug: 'taxovia-online',
    name: 'Księgowość Online Taxovia',
    description:
        'Zdalna księgowość dla jednoosobowych działalności i spółek. Dokumenty przesyłasz przez aplikację, a my rozliczamy podatki i ZUS.',
    logo: '/services/taxovia.png',
    category: 'financial',
    coverage: 'online',
    languages: ['pl', 'uk', 'en'],
    tags: ['Księgowość', 'JDG', 'Rozliczenia PIT'],
    verified: false,
    locations: [
        makeLocation({
            id: 'loc-online',
            city: null,
            street: null,
            postcode: null,
            voivodeship: null,
            latitude: null,
            longitude: null,
            phoneNumber: '+48 22 100 20 30',
            email: 'kontakt@taxovia.example',
            webpage: 'https://taxovia.example',
            socials: { linkedin: 'https://linkedin.com/company/taxovia', telegram: 'https://t.me/taxovia' },
            whatsappNumber: null,
            openingHours: {},
        }),
    ],
    mapHref: null,
    similarServices: SIMILAR_SERVICES.slice(0, 2).map(service => ({
        ...service,
        category: 'financial',
    })),
    premium: null,
};

export const noLogoServiceFixture: ServiceProfileView = {
    ...localServiceFixture,
    serviceId: 'c4e8a1f2-5d39-4b67-8e0a-9f3b2c6d7e03',
    slug: 'smaki-domu',
    name: 'Smaki Domu — pierogi i wareniki',
    description: null,
    logo: null,
    category: 'gastronomy',
    coverage: 'hybrid',
    tags: [],
    verified: false,
    locations: [makeLocation({ socials: null, webpage: null, email: null })],
    similarServices: [],
};

const REMONT_PHOTOS: ProfileImage[] = [1, 2, 3, 4, 5].map(index => ({
    src: `/services/remont${index}.png`,
    alt: `Realizacja remontu ${index}`,
}));

const BLOG_COVERS = [
    'ukrainskie-firmy-w-polsce/cover.jpg',
    'polish-shops-in-dublin/cover.jpg',
    'pps-number/cover.jpg',
    'branze-ukrainskich-firm-w-polsce/cover.png',
    'poles-in-ireland-history-of-emigration/cover.jpg',
    'polish-media-in-ireland/cover.jpg',
    'car-insurance-in-ireland/cover.jpg',
];

const PLACEHOLDER_PHOTOS: ProfileImage[] = BLOG_COVERS.map((file, index) => ({
    src: `/images/blog/${file}`,
    alt: `Zdjęcie przykładowe ${index + 1}`,
}));

const PREMIUM_CONTENT: PremiumContent = {
    template: 'gallery',
    coverImage: { src: '/services/remont2.png', alt: 'Narzędzia ekipy remontowej' },
    gallery: [...REMONT_PHOTOS, ...PLACEHOLDER_PHOTOS],
    priceList: [
        { name: 'Wycena i pomiar na miejscu', price: 'bezpłatnie' },
        { name: 'Malowanie ścian', price: 'od 25 zł/m²', note: 'Dwie warstwy, materiał klienta' },
        { name: 'Układanie płytek', price: 'od 120 zł/m²' },
        { name: 'Remont łazienki pod klucz', price: 'od 18 000 zł', note: 'Do 6 m²' },
        { name: 'Wymiana instalacji elektrycznej', price: 'od 250 zł/punkt' },
    ],
    faq: [
        {
            question: 'Ile trwa remont łazienki?',
            answer: 'Standardowa łazienka do 6 m² zajmuje nam od 10 do 14 dni roboczych, licząc od skucia płytek.',
        },
        {
            question: 'Czy kupujecie materiały?',
            answer: 'Tak. Możemy kupić materiały w hurtowni z naszym rabatem albo pracować na materiałach klienta.',
        },
        {
            question: 'Czy dajecie gwarancję?',
            answer: 'Na każdą pracę dajemy pisemną gwarancję na 24 miesiące.',
        },
    ],
};

export const premiumServiceFixture: PremiumProfileView = {
    ...localServiceFixture,
    premium: PREMIUM_CONTENT,
};

export const premiumProfessionalFixture: PremiumProfileView = {
    ...localServiceFixture,
    slug: 'kancelaria-nowak',
    name: 'Kancelaria Adwokacka Nowak i Wspólnicy',
    description:
        'Prawo pobytowe, prawo pracy i sprawy rodzinne cudzoziemców. Reprezentujemy klientów przed urzędami wojewódzkimi i sądami w całej Polsce.',
    logo: '/services/legallex.png',
    category: 'law',
    coverage: 'hybrid',
    languages: ['pl', 'uk', 'ru', 'en'],
    tags: ['Karta pobytu', 'Prawo pracy', 'Obywatelstwo'],
    locations: [
        makeLocation({
            street: 'ul. Marszałkowska 84/92 lok. 108',
            postcode: '00-514',
            email: 'kancelaria@nowak.example',
            webpage: 'https://nowak.example',
            socials: { linkedin: 'https://linkedin.com/company/nowak' },
            whatsappNumber: null,
        }),
    ],
    premium: {
        template: 'professional',
        coverImage: null,
        gallery: PLACEHOLDER_PHOTOS.slice(0, 4),
        priceList: [
            { name: 'Konsultacja (60 min)', price: '250 zł', note: 'Stacjonarnie lub online' },
            { name: 'Wniosek o kartę pobytu czasowego', price: 'od 1 200 zł' },
            { name: 'Wniosek o kartę pobytu stałego', price: 'od 1 800 zł' },
            { name: 'Odwołanie od decyzji wojewody', price: 'od 1 500 zł' },
            { name: 'Ponaglenie w sprawie przewlekłości', price: '400 zł' },
        ],
        faq: [
            {
                question: 'Czy konsultacja może odbyć się online?',
                answer: 'Tak. Konsultacje prowadzimy przez wideorozmowę w języku polskim, ukraińskim, rosyjskim lub angielskim.',
            },
            {
                question: 'Jakie dokumenty przynieść na pierwsze spotkanie?',
                answer: 'Paszport, aktualną decyzję pobytową oraz całą korespondencję z urzędem w sprawie.',
            },
            {
                question: 'Ile kosztuje prowadzenie sprawy?',
                answer: 'Po konsultacji przedstawiamy stałą wycenę całej sprawy. Nie doliczamy opłat godzinowych.',
            },
            {
                question: 'Czy reprezentujecie w sądzie administracyjnym?',
                answer: 'Tak, prowadzimy skargi do WSA i skargi kasacyjne do NSA.',
            },
        ],
    },
};

/** Premium oplacone przed publikacja tresci: bez cover, galerii, cennika, FAQ i adresu. */
export const premiumEmptyFixture: PremiumProfileView = {
    ...onlineServiceFixture,
    locations: [],
    premium: {
        template: 'classic',
        coverImage: null,
        gallery: [],
        priceList: [],
        faq: [],
    },
};
