export function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
}import { z } from 'zod';

export const categories = [
    { text: 'Grocery', image: '/icons/grocery.svg', variant: 'red' as const },
    { text: 'Gastronomy', image: '/icons/gastronomy.svg', variant: 'oversky' as const },
    { text: 'Transport', image: '/icons/transport.svg', variant: 'green' as const },
    { text: 'Financial', image: '/icons/financial.svg', variant: 'orange' as const },
    { text: 'Renovation', image: '/icons/renovation.svg', variant: 'blue' as const },
    { text: 'Law', image: '/icons/law.svg', variant: 'gold' as const },
    { text: 'Beauty', image: '/icons/beauty.svg', variant: 'violet' as const },
    { text: 'Government', image: '/icons/gov.svg', variant: 'aqua' as const },
    { text: 'Health', image: '/icons/health.svg', variant: 'lightblue' as const },
    { text: 'Mechanics', image: '/icons/mechanic.svg', variant: 'darkviolet' as const },
    { text: 'Entertainment', image: '/icons/entertainment.svg', variant: 'starfall' as const },
    { text: 'Education', image: '/icons/education.svg', variant: 'overworld' as const },
    { text: 'Others', image: '/icons/others.svg', variant: 'mojito' as const },
];

export const counties = {
    cities: {
        tile: 'Największe miasta',
        options: [
            'city:Warszawa',
            'city:Kraków',
            'city:Łódź',
            'city:Wrocław',
            'city:Poznań',
            'city:Gdańsk',
            'city:Szczecin',
        ],
    },
    voivodeships: {
        tile: 'Województwa',
        options: [
            'Dolnośląskie',
            'Kujawsko-Pomorskie',
            'Lubelskie',
            'Lubuskie',
            'Łódzkie',
            'Małopolskie',
            'Mazowieckie',
            'Opolskie',
            'Podkarpackie',
            'Podlaskie',
            'Pomorskie',
            'Śląskie',
            'Świętokrzyskie',
            'Warmińsko-Mazurskie',
            'Wielkopolskie',
            'Zachodniopomorskie',
        ],
    },
};

export const lockScroll = () => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflowY = 'hidden';
};

export const unlockScroll = () => {
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflowY = '';
    window.scrollTo(0, Number.parseInt(scrollY || '0') * -1);
};

export const ROUTES = {
    HOME: {
        path: '/',
        name: 'home',
    },
    MAP: {
        path: '/map',
        name: 'map',
    },
    CONTACT: {
        path: '/contact',
        name: 'contact',
    },
    BLOG: {
        path: '/blog',
        name: 'blog',
    },
} as const;

export const mapCategoryToBadgeColor = (category: string) => {
    switch (category) {
        case 'grocery':
            return 'red';
        case 'gastronomy':
            return 'oversky';
        case 'education':
            return 'sapphire';
        case 'law':
            return 'gold';
        case 'transport':
            return 'green';
        case 'mechanics':
            return 'darkviolet';
        case 'beauty':
            return 'pinkred';
        case 'financial':
            return 'orange';
        case 'health':
            return 'aqua';
        case 'renovation':
            return 'lightblue';
        case 'gov':
            return 'starfall';
        case 'entertainment':
            return 'violet';
        case 'others':
            return 'others';
        case 'government':
            return 'antricot';
        default:
            return 'default';
    }
}

export type Route = (typeof ROUTES)[keyof typeof ROUTES];


export const newsletterSchema = z.object({
    email: z
        .string()
        .min(1, { message: "Email is required" })
        .email({ message: "Invalid email address" })
        .max(100, { message: "Email must be less than 100 characters" }),
});

export type NewsletterFormData = z.infer<typeof newsletterSchema>;

// lib/format-address.ts
import { PartialService } from '@/types';

/**
 * Build a clean, comma-separated address string from the fields that exist.
 * Empty / undefined parts are silently skipped.
 */
export function formatAddress({
                                  street,
                                  postcode,
                                  city,
                                  voivodeship,
                              }: Pick<
    PartialService,
    'street' | 'postcode' | 'city' | 'voivodeship'
>): string {
    return [street, postcode, city, voivodeship]    // keep original order
        .map(part => part?.trim())                   // trim whitespace / handle undefined
        .filter(Boolean)                             // drop falsy entries
        .join(', ');
}

export const serviceName = "polvia";
export const serviceNameFromCapitalLetter = "Polvia";


