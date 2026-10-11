/**
 * @jest-environment node
 */
import { createFakeRedis } from '../../../tests/fixtures/add-business/fake-redis';
import type { BusinessDraft } from './draft-schema';
import { getDraft, MAX_RELOCATIONS, saveDraft, type StoredDraft } from './draft-store';
import { relocateDraft } from './relocate-draft';

const mockRedis = createFakeRedis();

// Redis i Nominatim (przez wstrzykniety `geocode`) to zewnetrzne serwisy.
jest.mock('@/lib/redis', () => ({
    get redis() {
        return mockRedis;
    },
}));

const TAG = { pl: 'Fryzjer', uk: 'Перукар', en: 'Hairdresser', ru: 'Парикмахер' };

const DRAFT: BusinessDraft = {
    category: 'beauty',
    coverage: 'local',
    languages: ['pl'],
    tags: [TAG, TAG, TAG],
    descriptions: { pl: 'Opis pl', uk: 'Опис uk', en: 'Description en', ru: 'Описание ru' },
    facts: {
        name: 'Salon Ola',
        street: 'ul. Kwiatowa 1',
        postcode: null,
        city: 'Kraków',
        phoneNumber: null,
        email: null,
        openingHours: null,
    },
    unconfirmed: ['postcode', 'phoneNumber', 'email', 'openingHours'],
};

const STORED: StoredDraft = {
    draft: DRAFT,
    locale: 'pl',
    source: 'owner',
    sourceUrl: null,
    logoCandidate: null,
    geo: null,
};

function relocateForm(draftId: string, street: string, city: string): FormData {
    const form = new FormData();
    form.set('draftId', draftId);
    form.set('street', street);
    form.set('city', city);
    return form;
}

beforeEach(() => {
    mockRedis.reset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('relocateDraft', () => {
    it('geokoduje adres, zapisuje geo w szkicu i zwraca pin', async () => {
        const geocode = jest.fn().mockResolvedValue({
            ok: true,
            lat: 50.06,
            lng: 19.94,
            postcode: '30-001',
            voivodeship: 'malopolskie',
            approximate: false,
        });
        const draftId = await saveDraft(STORED);

        const result = await relocateDraft(relocateForm(draftId, 'ul. Długa 2', 'Kraków'), {
            geocode,
        });

        expect(result).toEqual({
            status: 'relocated',
            pin: { lat: 50.06, lng: 19.94, approximate: false },
            remainingRelocations: MAX_RELOCATIONS - 1,
        });
        const stored = await getDraft(draftId);
        expect(stored.ok && stored.stored.geo?.address).toEqual({
            street: 'ul. Długa 2',
            city: 'Kraków',
        });
    });

    it('adres nieznaleziony daje ADDRESS_NOT_FOUND i nie zmienia szkicu', async () => {
        const geocode = jest.fn().mockResolvedValue({ ok: false, code: 'MISMATCH' });
        const draftId = await saveDraft(STORED);

        const result = await relocateDraft(relocateForm(draftId, '', 'Nibylandia'), { geocode });

        expect(result.status === 'error' && result.error.code).toBe('ADDRESS_NOT_FOUND');
        const stored = await getDraft(draftId);
        expect(stored.ok && stored.stored.geo).toBeNull();
    });

    it.each(['RATE_LIMITED', 'UPSTREAM_FAILED'] as const)(
        'geokoder %s daje GEOCODE_UNAVAILABLE i nie zmienia szkicu',
        async code => {
            const geocode = jest.fn().mockResolvedValue({ ok: false, code });
            const draftId = await saveDraft(STORED);

            const result = await relocateDraft(relocateForm(draftId, 'ul. Długa 2', 'Kraków'), {
                geocode,
            });

            expect(result.status === 'error' && result.error.code).toBe('GEOCODE_UNAVAILABLE');
            const stored = await getDraft(draftId);
            expect(stored.ok && stored.stored.geo).toBeNull();
        },
    );

    it('po wyczerpaniu limitu relokacji nie geokoduje', async () => {
        const geocode = jest.fn().mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
        const draftId = await saveDraft(STORED);
        for (let attempt = 0; attempt < MAX_RELOCATIONS; attempt++) {
            await relocateDraft(relocateForm(draftId, '', 'Kraków'), { geocode });
        }
        geocode.mockClear();

        const result = await relocateDraft(relocateForm(draftId, '', 'Kraków'), { geocode });

        expect(result.status === 'error' && result.error.code).toBe('RELOCATION_LIMIT');
        expect(geocode).not.toHaveBeenCalled();
    });

    it('wygasly szkic daje DRAFT_EXPIRED bez geokodowania', async () => {
        const geocode = jest.fn();

        const result = await relocateDraft(
            relocateForm('5f0c3c2e-8d7b-4a52-9d55-3f1a2b3c4d5e', '', 'Kraków'),
            { geocode },
        );

        expect(result.status === 'error' && result.error.code).toBe('DRAFT_EXPIRED');
        expect(geocode).not.toHaveBeenCalled();
    });

    it('brak miasta to blad pola', async () => {
        const geocode = jest.fn();
        const draftId = await saveDraft(STORED);

        const result = await relocateDraft(relocateForm(draftId, 'ul. Długa 2', ''), { geocode });

        expect(result).toEqual({
            status: 'invalid',
            fieldErrors: { city: 'addBusiness.errors.required' },
        });
    });
});
