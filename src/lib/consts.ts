export function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
}import { z } from 'zod';

import { CATEGORY_DEFINITIONS, type CategoryDefinition, isCategory } from '@/lib/categories';

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

export const mapCategoryToBadgeColor = (category: string): CategoryDefinition['badgeColor'] | 'default' =>
    isCategory(category) ? CATEGORY_DEFINITIONS[category].badgeColor : 'default';

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

/**
 * Maps DB voivodeship enum values (ASCII) to the i18n message keys (with diacritics).
 * Usage: t(`counties.${VOIVODESHIP_TO_MESSAGE_KEY[voivodeship]}`)
 */
export const VOIVODESHIP_TO_MESSAGE_KEY: Record<string, string> = {
    'dolnoslaskie': 'dolnośląskie',
    'kujawsko-pomorskie': 'kujawsko-pomorskie',
    'lubelskie': 'lubelskie',
    'lubuskie': 'lubuskie',
    'lodzkie': 'łódzkie',
    'malopolskie': 'małopolskie',
    'mazowieckie': 'mazowieckie',
    'opolskie': 'opolskie',
    'podkarpackie': 'podkarpackie',
    'podlaskie': 'podlaskie',
    'pomorskie': 'pomorskie',
    'slaskie': 'śląskie',
    'swietokrzyskie': 'świętokrzyskie',
    'warminsko-mazurskie': 'warmińsko-mazurskie',
    'wielkopolskie': 'wielkopolskie',
    'zachodniopomorskie': 'zachodniopomorskie',
};

export const serviceName = "polvia";
export const serviceNameFromCapitalLetter = "Polvia";


