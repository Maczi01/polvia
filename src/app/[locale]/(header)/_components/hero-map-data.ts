import type { VoivodeshipStats } from '@/lib/queries';

/** Statyczna czesc pinu: pozycja na mapie, ikona i wojewodztwo. Liczby przychodza z bazy. */
export type HeroPinDefinition = {
    svgLabel: string;
    categoryKey: string;
    icon: string;
    variant: string;
    position: { x: number; y: number };
    voivodeship: string;
    voivodeshipKey: string;
};

export type HeroPin = HeroPinDefinition & {
    placesCount: number;
    categoriesCount: number;
};

export const HERO_PINS: HeroPinDefinition[] = [
    {
        svgLabel: 'Beauty',
        categoryKey: 'beauty',
        icon: '/icons/beauty.svg',
        variant: 'violet',
        position: { x: 198, y: 168 },
        voivodeship: 'Zachodniopomorskie',
        voivodeshipKey: 'zachodniopomorskie',
    },
    {
        svgLabel: 'Education',
        categoryKey: 'education',
        icon: '/icons/education.svg',
        variant: 'overworld',
        position: { x: 338, y: 108 },
        voivodeship: 'Pomorskie',
        voivodeshipKey: 'pomorskie',
    },
    {
        svgLabel: 'RealEstate',
        categoryKey: 'real_estate',
        icon: '/icons/real-estate.svg',
        variant: 'starfall',
        position: { x: 488, y: 145 },
        voivodeship: 'Warmińsko-Mazurskie',
        voivodeshipKey: 'warminsko-mazurskie',
    },
    {
        svgLabel: 'Financial',
        categoryKey: 'financial',
        icon: '/icons/financial.svg',
        variant: 'orange',
        position: { x: 618, y: 212 },
        voivodeship: 'Podlaskie',
        voivodeshipKey: 'podlaskie',
    },
    {
        svgLabel: 'Gastronomy',
        categoryKey: 'gastronomy',
        icon: '/icons/gastronomy.svg',
        variant: 'oversky',
        position: { x: 185, y: 295 },
        voivodeship: 'Lubuskie',
        voivodeshipKey: 'lubuskie',
    },
    {
        svgLabel: 'Grocery',
        categoryKey: 'grocery',
        icon: '/icons/grocery.svg',
        variant: 'red',
        position: { x: 290, y: 302 },
        voivodeship: 'Wielkopolskie',
        voivodeshipKey: 'wielkopolskie',
    },
    {
        svgLabel: 'Health',
        categoryKey: 'health',
        icon: '/icons/health.svg',
        variant: 'lightblue',
        position: { x: 359, y: 225 },
        voivodeship: 'Kujawsko-Pomorskie',
        voivodeshipKey: 'kujawsko-pomorskie',
    },
    {
        svgLabel: 'Law',
        categoryKey: 'law',
        icon: '/icons/law.svg',
        variant: 'gold',
        position: { x: 508, y: 295 },
        voivodeship: 'Mazowieckie',
        voivodeshipKey: 'mazowieckie',
    },
    {
        svgLabel: 'Mechanics',
        categoryKey: 'mechanics',
        icon: '/icons/mechanic.svg',
        variant: 'darkviolet',
        position: { x: 415, y: 358 },
        voivodeship: 'Łódzkie',
        voivodeshipKey: 'lodzkie',
    },
    {
        svgLabel: 'Others',
        categoryKey: 'others',
        icon: '/icons/others.svg',
        variant: 'mojito',
        position: { x: 238, y: 410 },
        voivodeship: 'Dolnośląskie',
        voivodeshipKey: 'dolnoslaskie',
    },
    {
        svgLabel: 'Renovation',
        categoryKey: 'renovation',
        icon: '/icons/renovation.svg',
        variant: 'blue',
        position: { x: 460, y: 530 },
        voivodeship: 'Małopolskie',
        voivodeshipKey: 'malopolskie',
    },
    {
        svgLabel: 'Transport',
        categoryKey: 'transport',
        icon: '/icons/transport.svg',
        variant: 'green',
        position: { x: 612, y: 392 },
        voivodeship: 'Lubelskie',
        voivodeshipKey: 'lubelskie',
    },
    {
        svgLabel: 'Search',
        categoryKey: '',
        icon: '/icons/others.svg',
        variant: 'green',
        position: { x: 575, y: 518 },
        voivodeship: 'Podkarpackie',
        voivodeshipKey: 'podkarpackie',
    },
    {
        svgLabel: 'Technology',
        categoryKey: 'technology',
        icon: '/icons/others.svg',
        variant: 'cyan',
        position: { x: 310, y: 465 },
        voivodeship: 'Opolskie',
        voivodeshipKey: 'opolskie',
    },
    {
        svgLabel: 'Construction',
        categoryKey: 'construction',
        icon: '/icons/others.svg',
        variant: 'pink',
        position: { x: 370, y: 498 },
        voivodeship: 'Śląskie',
        voivodeshipKey: 'slaskie',
    },
    {
        svgLabel: 'Pets',
        categoryKey: 'pets',
        icon: '/icons/others.svg',
        variant: 'amber',
        position: { x: 508, y: 442 },
        voivodeship: 'Świętokrzyskie',
        voivodeshipKey: 'swietokrzyskie',
    },
];

/**
 * Dokleja do pinow prawdziwe liczby z bazy. Wojewodztwo bez aktywnych firm
 * dostaje 0 — wczesniej zostawala w nim zmyslona liczba z tego pliku.
 */
export function withVoivodeshipStats(
    pins: HeroPinDefinition[],
    stats: VoivodeshipStats[],
): HeroPin[] {
    const statsByVoivodeship = new Map(stats.map(entry => [entry.voivodeship, entry]));

    return pins.map(pin => {
        const entry = statsByVoivodeship.get(pin.voivodeshipKey);
        return {
            ...pin,
            placesCount: entry?.companiesCount ?? 0,
            categoriesCount: entry?.categoriesCount ?? 0,
        };
    });
}
