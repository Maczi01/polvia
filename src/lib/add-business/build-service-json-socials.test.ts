/**
 * @jest-environment node
 */
import { serviceInputSchema } from '@/db/service-input-schema';
import { buildServiceJson } from '@/lib/add-business/build-service-json';
import type { BusinessDraft } from '@/lib/add-business/draft-schema';
import type { StoredDraft } from '@/lib/add-business/draft-store';
import type { OwnerEdits } from '@/lib/add-business/owner-edits-schema';
import type { Socials } from '@/lib/add-business/social-links';

/** Social media i WhatsApp w pliku wpisu (A) — ksztalt kolumn `socials` / `whatsapp_number`. */

const TAG = { pl: 'Tag', uk: 'Тег', en: 'Tag', ru: 'Тег' };

const DRAFT: BusinessDraft = {
    category: 'gastronomy',
    coverage: 'local',
    languages: ['pl'],
    tags: [TAG, TAG, TAG],
    descriptions: { pl: 'Opis', uk: 'Опис', en: 'Description', ru: 'Описание' },
    facts: {
        name: 'Kawiarnia Ola',
        street: 'ul. Długa 1',
        postcode: '80-831',
        city: 'Gdańsk',
        phoneNumber: null,
        email: null,
        openingHours: null,
    },
    socials: { facebook: 'https://www.facebook.com/ola' },
    whatsappNumber: null,
    unconfirmed: [],
};

const STORED: StoredDraft = {
    draft: DRAFT,
    locale: 'pl',
    source: 'page',
    sourceUrl: 'https://ola.pl/',
    logoCandidate: null,
    geo: {
        lat: 54.349,
        lng: 18.653,
        approximate: false,
        voivodeship: 'pomorskie',
        postcode: '80-831',
        address: { street: 'ul. Długa 1', city: 'Gdańsk' },
    },
};

const ALL_SOCIALS: Required<Socials> = {
    whatsapp: 'https://wa.me/message/ABC123',
    telegram: 'https://t.me/kawiarnia_ola',
    facebook: 'https://www.facebook.com/ola',
    instagram: 'https://www.instagram.com/ola/',
    tiktok: 'https://www.tiktok.com/@ola',
    youtube: 'https://www.youtube.com/@ola',
    linkedin: 'https://www.linkedin.com/company/ola',
    viber: 'https://invite.viber.com/?g2=ola',
    tripadvisor: 'https://www.tripadvisor.com/Restaurant_Review-g1-d2',
    x: 'https://x.com/ola',
};

function edits(overrides: Partial<OwnerEdits> = {}): OwnerEdits {
    return {
        name: 'Kawiarnia Ola',
        street: 'ul. Długa 1',
        postcode: '80-831',
        city: 'Gdańsk',
        phoneNumber: null,
        email: null,
        webpage: 'https://ola.pl/',
        openingHours: null,
        languages: ['pl'],
        socials: DRAFT.socials,
        whatsappNumber: null,
        pin: null,
        submitterEmail: 'ola@ola.pl',
        notes: null,
        ...overrides,
    };
}

function build(overrides: Partial<OwnerEdits>) {
    return buildServiceJson({ stored: STORED, edits: edits(overrides), geo: STORED.geo, hasLogo: false });
}

describe('buildServiceJson — social media', () => {
    it('pelny zestaw socials i numer WhatsApp przechodzi serviceInputSchema', () => {
        const result = build({ socials: ALL_SOCIALS, whatsappNumber: '+48500600700' });

        if (!result.ok) throw new Error('oczekiwano ok');
        const [location] = result.json.locations;
        expect(location.socials).toEqual(ALL_SOCIALS);
        expect(location.whatsappNumber).toBe('+48500600700');
        expect(serviceInputSchema.safeParse(result.json).success).toBe(true);
        expect(result.changedByOwner).toEqual(['socials', 'whatsappNumber']);
    });

    it('puste socials i brak numeru nie zapisuja pustych kluczy', () => {
        const result = build({ socials: {}, whatsappNumber: null });

        if (!result.ok) throw new Error('oczekiwano ok');
        const [location] = result.json.locations;
        expect(location).not.toHaveProperty('socials');
        expect(location).not.toHaveProperty('whatsappNumber');
        // Wlasciciel usunal Facebooka ze szkicu — operator to widzi.
        expect(result.changedByOwner).toContain('socials');
    });

    it('socials ze szkicu bez zmian nie sa raportowane jako zmiana wlasciciela', () => {
        const result = build({});

        if (!result.ok) throw new Error('oczekiwano ok');
        expect(result.changedByOwner).toEqual([]);
    });
});
