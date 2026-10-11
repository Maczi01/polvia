/**
 * Wspolne dane i atrapy zaleznosci zewnetrznych `submitDraft` (Nominatim, SMTP, logo ze
 * strony) dla testow orkiestratora. Redis, env i nodemailer podmieniaja same pliki testow
 * (`jest.mock` jest per plik).
 */
import type { BusinessDraft } from '@/lib/add-business/draft-schema';
import type { StoredDraft } from '@/lib/add-business/draft-store';
import type { GeocodeResult } from '@/lib/add-business/geocode';
import type { SubmitDraftDeps } from '@/lib/add-business/submit-draft';

export const IP = '198.51.100.20';
export const OWNER_EMAIL = 'wlasciciel@example.com';
export const OWNER_NOTES = 'Mamy tez punkt w Gdansku, prosze o kontakt pod 600 000 000.';

export const TAG = {
    pl: 'Prawo pracy',
    uk: 'Трудове право',
    en: 'Labour law',
    ru: 'Трудовое право',
};

export const DRAFT: BusinessDraft = {
    category: 'law',
    coverage: 'hybrid',
    languages: ['pl', 'uk'],
    tags: [TAG, TAG, TAG],
    descriptions: { pl: 'Opis pl', uk: 'Опис uk', en: 'Description en', ru: 'Описание ru' },
    facts: {
        name: 'Kancelaria Nowak',
        street: 'ul. Prosta 1',
        postcode: '00-001',
        city: 'Warszawa',
        phoneNumber: null,
        email: 'biuro@nowak.example.pl',
        openingHours: null,
    },
    unconfirmed: ['phoneNumber', 'openingHours'],
};

export const STORED: StoredDraft = {
    draft: DRAFT,
    locale: 'pl',
    source: 'page',
    sourceUrl: 'https://nowak.example.pl/',
    logoCandidate: null,
    geo: {
        lat: 52.23,
        lng: 21.01,
        approximate: false,
        voivodeship: 'mazowieckie',
        postcode: '00-001',
        address: { street: 'ul. Prosta 1', city: 'Warszawa' },
    },
};

export const GEOCODED: GeocodeResult = {
    ok: true,
    lat: 50.06,
    lng: 19.94,
    postcode: '30-001',
    voivodeship: 'malopolskie',
    approximate: true,
};

export const LOGO_PNG = Buffer.from('png-bytes');

export interface Harness {
    deps: SubmitDraftDeps;
    sendMail: jest.Mock;
    geocode: jest.Mock;
    fetchLogoCandidate: jest.Mock;
}

export function harness(): Harness {
    const sendMail = jest.fn().mockResolvedValue({ ok: true });
    const geocode = jest.fn().mockResolvedValue(GEOCODED);
    const fetchLogoCandidate = jest.fn().mockResolvedValue(LOGO_PNG);
    return {
        deps: { sendMail, geocode, fetchLogoCandidate },
        sendMail,
        geocode,
        fetchLogoCandidate,
    };
}

export function submitForm(draftId: string, overrides: Record<string, string> = {}): FormData {
    const form = new FormData();
    const fields: Record<string, string> = {
        draftId,
        name: 'Kancelaria Nowak',
        street: 'ul. Prosta 1',
        postcode: '00-001',
        city: 'Warszawa',
        phoneNumber: '',
        email: 'biuro@nowak.example.pl',
        webpage: 'https://nowak.example.pl/',
        submitterEmail: OWNER_EMAIL,
        notes: OWNER_NOTES,
        ...overrides,
    };
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    form.append('languages', 'pl');
    form.append('languages', 'uk');
    return form;
}

export function operatorEntry(sendMail: jest.Mock): Record<string, unknown> {
    const [message] = sendMail.mock.calls[0];
    return JSON.parse(message.attachments[0].content);
}
