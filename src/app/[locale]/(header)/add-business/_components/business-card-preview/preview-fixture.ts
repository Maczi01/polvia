import type { BusinessPreview, DraftPin } from '@/lib/add-business/types';

/** Dane przykladowe dla testow i stories podgladu karty (kolokowane, bo uzywa ich i Storybook). */

const DAY = { open: '09:00', close: '17:00' };

export const PREVIEW_FIXTURE: BusinessPreview = {
    name: 'Kawiarnia Lwów',
    category: 'gastronomy',
    coverage: 'hybrid',
    languages: ['pl', 'uk'],
    tags: [
        { pl: 'kawiarnia', uk: 'кав’ярня', en: 'cafe', ru: 'кафе' },
        { pl: 'wypieki', uk: 'випічка', en: 'pastries', ru: 'выпечка' },
        { pl: 'catering', uk: 'кейтеринг', en: 'catering', ru: 'кейтеринг' },
    ],
    descriptions: {
        pl: 'Kawiarnia z ukraińskimi wypiekami w centrum Gdańska.',
        uk: 'Кав’ярня з українською випічкою в центрі Гданська.',
        en: 'A cafe with Ukrainian pastries in central Gdańsk.',
        ru: 'Кафе с украинской выпечкой в центре Гданьска.',
    },
    street: 'ul. Długa 1',
    postcode: '80-831',
    city: 'Gdańsk',
    phoneNumber: '+48 500 600 700',
    email: 'kontakt@kawiarnia.pl',
    webpage: 'https://kawiarnia.pl',
    openingHours: {
        monday: DAY,
        tuesday: DAY,
        wednesday: DAY,
        thursday: DAY,
        friday: DAY,
        saturday: DAY,
        sunday: DAY,
    },
    socials: {},
    whatsappNumber: null,
};

export const PIN_FIXTURE: DraftPin = { lat: 54.349, lng: 18.653, approximate: false };
