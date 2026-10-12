/**
 * @jest-environment node
 */
import { type BusinessDraft, businessDraftSchema } from '@/lib/add-business/draft-schema';

/** Zapis szkicu do Redisa waliduje prefill social media (A). */

const TAG = { pl: 'Tag', uk: 'Тег', en: 'Tag', ru: 'Тег' };

const DRAFT: BusinessDraft = {
    category: 'beauty',
    coverage: 'local',
    languages: ['pl'],
    tags: [TAG, TAG, TAG],
    descriptions: { pl: 'Opis', uk: 'Опис', en: 'Description', ru: 'Описание' },
    facts: {
        name: 'Salon Ola',
        street: null,
        postcode: null,
        city: 'Kraków',
        phoneNumber: null,
        email: null,
        openingHours: null,
    },
    socials: { instagram: 'https://www.instagram.com/salon.ola/' },
    whatsappNumber: '+48500600700',
    unconfirmed: [],
};

describe('businessDraftSchema — socials i whatsappNumber', () => {
    it('poprawny prefill przechodzi', () => {
        expect(businessDraftSchema.safeParse(DRAFT).success).toBe(true);
    });

    it.each([
        { socials: { instagram: 'javascript:alert(1)' } },
        { socials: { myspace: 'https://myspace.com/ola' } },
        { whatsappNumber: '500 600 700' },
    ])('odrzuca %o', overrides => {
        expect(businessDraftSchema.safeParse({ ...DRAFT, ...overrides }).success).toBe(false);
    });
});
