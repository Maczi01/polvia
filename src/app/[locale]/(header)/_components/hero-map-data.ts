export type HeroPin = {
    svgLabel: string;
    categoryKey: string;
    icon: string;
    variant: string;
    position: { x: number; y: number };
    placesCount: number;
    exampleCities: string[];
    exampleCompanies: string[];
};

export const HERO_PINS: HeroPin[] = [
    {
        svgLabel: 'Beauty',
        categoryKey: 'beauty',
        icon: '/icons/beauty.svg',
        variant: 'violet',
        position: { x: 198, y: 168 },
        placesCount: 8,
        exampleCities: ['Szczecin', 'Koszalin'],
        exampleCompanies: ['Salon Glamour', 'Beauty House'],
    },
    {
        svgLabel: 'Education',
        categoryKey: 'education',
        icon: '/icons/education.svg',
        variant: 'overworld',
        position: { x: 338, y: 108 },
        placesCount: 5,
        exampleCities: ['Gdańsk', 'Gdynia'],
        exampleCompanies: ['EduCenter', 'Lingua Plus'],
    },
    {
        svgLabel: 'Entertainment',
        categoryKey: 'entertainment',
        icon: '/icons/entertainment.svg',
        variant: 'starfall',
        position: { x: 488, y: 145 },
        placesCount: 11,
        exampleCities: ['Olsztyn', 'Ełk'],
        exampleCompanies: ['FunPark', 'CineMax'],
    },
    {
        svgLabel: 'Financial',
        categoryKey: 'financial',
        icon: '/icons/financial.svg',
        variant: 'orange',
        position: { x: 618, y: 212 },
        placesCount: 7,
        exampleCities: ['Białystok', 'Łomża'],
        exampleCompanies: ['FinExpert', 'MoneyWise'],
    },
    {
        svgLabel: 'Gastronomy',
        categoryKey: 'gastronomy',
        icon: '/icons/gastronomy.svg',
        variant: 'oversky',
        position: { x: 185, y: 295 },
        placesCount: 13,
        exampleCities: ['Zielona Góra', 'Gorzów'],
        exampleCompanies: ['Smaczek', 'Domowa Kuchnia'],
    },
    {
        svgLabel: 'Grocery',
        categoryKey: 'grocery',
        icon: '/icons/grocery.svg',
        variant: 'red',
        position: { x: 290, y: 302 },
        placesCount: 15,
        exampleCities: ['Poznań', 'Kalisz'],
        exampleCompanies: ['FreshMarket', 'Smak Wschodu'],
    },
    {
        svgLabel: 'Health',
        categoryKey: 'health',
        icon: '/icons/health.svg',
        variant: 'lightblue',
        position: { x: 359, y: 225 },
        placesCount: 9,
        exampleCities: ['Bydgoszcz', 'Toruń'],
        exampleCompanies: ['MedClinic', 'Zdrowie+'],
    },
    {
        svgLabel: 'Law',
        categoryKey: 'law',
        icon: '/icons/law.svg',
        variant: 'gold',
        position: { x: 508, y: 295 },
        placesCount: 4,
        exampleCities: ['Warszawa', 'Radom'],
        exampleCompanies: ['LexPol', 'Kancelaria Prawa'],
    },
    {
        svgLabel: 'Mechanics',
        categoryKey: 'mechanics',
        icon: '/icons/mechanic.svg',
        variant: 'darkviolet',
        position: { x: 415, y: 358 },
        placesCount: 6,
        exampleCities: ['Łódź', 'Piotrków'],
        exampleCompanies: ['AutoFix', 'MechanikPro'],
    },
    {
        svgLabel: 'Others',
        categoryKey: 'others',
        icon: '/icons/others.svg',
        variant: 'mojito',
        position: { x: 238, y: 410 },
        placesCount: 12,
        exampleCities: ['Wrocław', 'Legnica'],
        exampleCompanies: ['UsługiXL', 'MultiSerwis'],
    },
    {
        svgLabel: 'Renovation',
        categoryKey: 'renovation',
        icon: '/icons/renovation.svg',
        variant: 'blue',
        position: { x: 460, y: 530 },
        placesCount: 10,
        exampleCities: ['Kraków', 'Tarnów'],
        exampleCompanies: ['RemontPro', 'BudExpert'],
    },
    {
        svgLabel: 'Transport',
        categoryKey: 'transport',
        icon: '/icons/transport.svg',
        variant: 'green',
        position: { x: 612, y: 392 },
        placesCount: 3,
        exampleCities: ['Lublin', 'Zamość'],
        exampleCompanies: ['TransExpress', 'PrzewózPL'],
    },
    {
        svgLabel: 'Search',
        categoryKey: '',
        icon: '/icons/others.svg',
        variant: 'green',
        position: { x: 575, y: 518 },
        placesCount: 14,
        exampleCities: ['Rzeszów', 'Przemyśl'],
        exampleCompanies: [],
    },
];

export const HERO_PIN_MAP = new Map<string, HeroPin>(
    HERO_PINS.map((pin) => [pin.svgLabel, pin]),
);
