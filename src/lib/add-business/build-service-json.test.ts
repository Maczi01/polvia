/**
 * @jest-environment node
 */
import { serviceInputSchema } from '@/db/service-input-schema';
import { buildServiceJson } from '@/lib/add-business/build-service-json';
import type { BusinessDraft } from '@/lib/add-business/draft-schema';
import type { DraftGeo, StoredDraft } from '@/lib/add-business/draft-store';
import type { OwnerEdits } from '@/lib/add-business/owner-edits-schema';

const DRAFT: BusinessDraft = {
    category: 'law',
    coverage: 'hybrid',
    languages: ['pl', 'uk'],
    tags: [
        { pl: 'Prawo pracy', uk: 'Трудове право', en: 'Labour law', ru: 'Трудовое право' },
        { pl: 'Legalizacja', uk: 'Легалізація', en: 'Legalisation', ru: 'Легализация' },
        { pl: 'Kancelaria', uk: 'Адвокатське бюро', en: 'Law firm', ru: 'Адвокатское бюро' },
    ],
    descriptions: {
        pl: 'Kancelaria prawna w Warszawie.',
        uk: 'Юридична фірма у Варшаві.',
        en: 'Law firm in Warsaw.',
        ru: 'Юридическая фирма в Варшаве.',
    },
    facts: {
        name: 'Kancelaria Nowak',
        street: 'ul. Prosta 1',
        postcode: '00-001',
        city: 'Warszawa',
        phoneNumber: '+48 500 600 700',
        email: null,
        openingHours: { monday: { open: '09:00', close: '17:00' } },
    },
    unconfirmed: ['email'],
};

const GEO: DraftGeo = {
    lat: 52.2297,
    lng: 21.0122,
    approximate: false,
    voivodeship: 'mazowieckie',
    postcode: '00-002',
    address: { street: 'ul. Prosta 1', city: 'Warszawa' },
};

function stored(draft: BusinessDraft = DRAFT): StoredDraft {
    return {
        draft,
        locale: 'pl',
        source: 'page',
        sourceUrl: 'https://nowak.pl/',
        logoCandidate: null,
        geo: GEO,
    };
}

/** Formularz wypelniony wartosciami szkicu, bez zadnej zmiany wlasciciela. */
function untouchedEdits(draft: BusinessDraft = DRAFT): OwnerEdits {
    return {
        name: draft.facts.name ?? 'Firma',
        street: draft.facts.street,
        postcode: draft.facts.postcode,
        city: draft.facts.city ?? 'Warszawa',
        phoneNumber: draft.facts.phoneNumber,
        email: draft.facts.email,
        webpage: 'https://nowak.pl/',
        openingHours: draft.facts.openingHours,
        languages: draft.languages,
        submitterEmail: 'wlasciciel@nowak.pl',
        notes: null,
    };
}

describe('buildServiceJson — kontrakt db:add', () => {
    it('pelny draft hybrid z koordynatami + edycje przechodzi serviceInputSchema', () => {
        const result = buildServiceJson({
            stored: stored(),
            edits: { ...untouchedEdits(), email: 'biuro@nowak.pl' },
            geo: GEO,
            hasLogo: true,
        });

        if (!result.ok) throw new Error(result.code);
        expect(serviceInputSchema.safeParse(result.json).success).toBe(true);
        expect(result.slug).toBe('kancelaria-nowak');
        expect(result.json.image).toBe('kancelaria-nowak.png');
        expect(result.missingCoordinates).toBe(false);
        expect(result.json).toMatchObject({
            name: 'Kancelaria Nowak',
            category: 'law',
            coverage: 'hybrid',
            languages: ['pl', 'uk'],
            translations: { pl: { description: 'Kancelaria prawna w Warszawie.' } },
            tags: DRAFT.tags,
            locations: [
                {
                    city: 'Warszawa',
                    street: 'ul. Prosta 1',
                    postcode: '00-001',
                    voivodeship: 'mazowieckie',
                    latitude: 52.2297,
                    longitude: 21.0122,
                    phoneNumber: '+48 500 600 700',
                    email: 'biuro@nowak.pl',
                    webpage: 'https://nowak.pl/',
                    openingHours: { monday: { open: '09:00', close: '17:00' } },
                    isMainLocation: true,
                },
            ],
        });
    });

    it('bez logo nie ustawia klucza image', () => {
        const result = buildServiceJson({
            stored: stored(),
            edits: untouchedEdits(),
            geo: GEO,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.json).not.toHaveProperty('image');
    });

    it('draft local bez wspolrzednych: wynik zbudowany, missingCoordinates true', () => {
        const draft: BusinessDraft = { ...DRAFT, coverage: 'local' };

        const result = buildServiceJson({
            stored: stored(draft),
            edits: untouchedEdits(draft),
            geo: null,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.missingCoordinates).toBe(true);
        expect(result.json.locations[0]).not.toHaveProperty('latitude');
    });

    it('draft online bez wspolrzednych: missingCoordinates false i JSON waliduje sie', () => {
        const draft: BusinessDraft = { ...DRAFT, coverage: 'online' };

        const result = buildServiceJson({
            stored: stored(draft),
            edits: untouchedEdits(draft),
            geo: null,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.missingCoordinates).toBe(false);
        expect(serviceInputSchema.safeParse(result.json).success).toBe(true);
    });

    it('nazwa bez znakow do slugu to INVALID_ENTRY, nie wyjatek', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = buildServiceJson({
            stored: stored(),
            edits: { ...untouchedEdits(), name: '!!!' },
            geo: GEO,
            hasLogo: false,
        });

        expect(result).toEqual({ ok: false, code: 'INVALID_ENTRY' });
        warn.mockRestore();
    });

    it('blad schematu inny niz brak wspolrzednych to INVALID_ENTRY z logiem', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = buildServiceJson({
            stored: stored(),
            edits: { ...untouchedEdits(), name: 'x'.repeat(300) },
            geo: GEO,
            hasLogo: false,
        });

        expect(result).toEqual({ ok: false, code: 'INVALID_ENTRY' });
        expect(warn).toHaveBeenCalledWith(
            'add-business entry invalid',
            expect.objectContaining({ issues: expect.arrayContaining(['name:too_big']) }),
        );
        warn.mockRestore();
    });
});

describe('buildServiceJson — zmiany wlasciciela', () => {
    it('edycja telefonu trafia do changedByOwner, pole niezmienione nie trafia', () => {
        const result = buildServiceJson({
            stored: stored(),
            edits: { ...untouchedEdits(), phoneNumber: '+48 111 222 333' },
            geo: GEO,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.changedByOwner).toEqual(['phoneNumber']);
        expect(result.json.locations[0].phoneNumber).toBe('+48 111 222 333');
    });

    it('formularz bez zmian daje pusta changedByOwner (kolejnosc jezykow nie jest zmiana)', () => {
        const result = buildServiceJson({
            stored: stored(),
            edits: { ...untouchedEdits(), languages: ['uk', 'pl'] },
            geo: GEO,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.changedByOwner).toEqual([]);
    });

    it('zmiana godzin, jezykow i strony jest wykrywana', () => {
        const result = buildServiceJson({
            stored: stored(),
            edits: {
                ...untouchedEdits(),
                openingHours: { monday: { open: '08:00', close: '17:00' } },
                languages: ['pl', 'uk', 'ru'],
                webpage: 'https://kancelaria-nowak.pl/',
            },
            geo: GEO,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.changedByOwner).toEqual(['openingHours', 'webpage', 'languages']);
        expect(result.json.languages).toEqual(['pl', 'uk', 'ru']);
    });

    it('pole uzupelnione przez wlasciciela schodzi z unconfirmed, puste zostaje', () => {
        const draft: BusinessDraft = {
            ...DRAFT,
            facts: { ...DRAFT.facts, phoneNumber: null },
            unconfirmed: ['email', 'phoneNumber'],
        };

        const result = buildServiceJson({
            stored: stored(draft),
            edits: { ...untouchedEdits(draft), email: 'biuro@nowak.pl' },
            geo: GEO,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.unconfirmed).toEqual(['phoneNumber']);
        expect(result.changedByOwner).toEqual(['email']);
    });

    it('kod pocztowy z geo uzupelnia tylko puste pole wlasciciela', () => {
        const result = buildServiceJson({
            stored: stored(),
            edits: { ...untouchedEdits(), postcode: null },
            geo: GEO,
            hasLogo: false,
        });

        if (!result.ok) throw new Error(result.code);
        expect(result.json.locations[0].postcode).toBe('00-002');
    });
});
