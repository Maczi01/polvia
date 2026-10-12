/**
 * @jest-environment node
 */
import { WEEKDAY_KEYS } from '@/db/service-input-schema';
import {
    NOTES_MAX_LENGTH,
    OWNER_EDIT_ERRORS,
    parseOwnerEdits,
} from '@/lib/add-business/owner-edits-schema';

const TEXT_FIELDS = ['name', 'street', 'postcode', 'city', 'phoneNumber', 'email', 'webpage'];

function validForm(overrides: Record<string, string | string[]> = {}): FormData {
    const values: Record<string, string | string[]> = {
        name: 'Kancelaria Nowak',
        street: 'ul. Prosta 1',
        postcode: '00-001',
        city: 'Warszawa',
        phoneNumber: '+48 500 600 700',
        email: 'biuro@nowak.pl',
        webpage: 'https://nowak.pl',
        hoursEnabled: 'on',
        'hours.monday.open': '09:00',
        'hours.monday.close': '17:00',
        languages: ['pl', 'uk'],
        submitterEmail: 'wlasciciel@nowak.pl',
        notes: 'Prosze o dodanie',
        ...overrides,
    };
    const formData = new FormData();
    for (const [key, value] of Object.entries(values)) {
        for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
    }
    return formData;
}

describe('parseOwnerEdits', () => {
    it('poprawny formularz daje komplet pol z godzinami w ksztalcie serviceInputSchema', () => {
        const result = parseOwnerEdits(validForm());

        expect(result).toEqual({
            ok: true,
            data: {
                name: 'Kancelaria Nowak',
                street: 'ul. Prosta 1',
                postcode: '00-001',
                city: 'Warszawa',
                phoneNumber: '+48 500 600 700',
                email: 'biuro@nowak.pl',
                webpage: 'https://nowak.pl',
                openingHours: { monday: { open: '09:00', close: '17:00' } },
                languages: ['pl', 'uk'],
                socials: {},
                whatsappNumber: null,
                pin: null,
                submitterEmail: 'wlasciciel@nowak.pl',
                notes: 'Prosze o dodanie',
            },
        });
    });

    it('pola ustawione na pusty string (nie pominiete) staja sie null, nie 0', () => {
        const empties: Record<string, string> = Object.fromEntries(
            ['street', 'postcode', 'phoneNumber', 'email', 'webpage', 'notes'].map(key => [
                key,
                '',
            ]),
        );
        for (const day of WEEKDAY_KEYS) {
            empties[`hours.${day}.open`] = '';
            empties[`hours.${day}.close`] = '';
        }

        const result = parseOwnerEdits(validForm(empties));

        if (!result.ok) throw new Error(JSON.stringify(result.fieldErrors));
        expect(result.data).toMatchObject({
            street: null,
            postcode: null,
            phoneNumber: null,
            email: null,
            webpage: null,
            notes: null,
            openingHours: null,
        });
    });

    it('pusta para godzin pomija dzien, pozostale dni zostaja', () => {
        const result = parseOwnerEdits(
            validForm({
                'hours.tuesday.open': '',
                'hours.tuesday.close': '',
                'hours.saturday.open': '10:00',
                'hours.saturday.close': '14:00',
            }),
        );

        if (!result.ok) throw new Error(JSON.stringify(result.fieldErrors));
        expect(result.data.openingHours).toEqual({
            monday: { open: '09:00', close: '17:00' },
            saturday: { open: '10:00', close: '14:00' },
        });
    });

    it('uszkodzony e-mail zglaszajacego daje blad pola z kluczem tlumaczenia', () => {
        const result = parseOwnerEdits(validForm({ submitterEmail: 'nie-mail@' }));

        expect(result).toEqual({
            ok: false,
            fieldErrors: { submitterEmail: OWNER_EDIT_ERRORS.invalidEmail },
        });
    });

    it('brak e-maila zglaszajacego, nazwy i miasta to bledy wymagalnosci', () => {
        const result = parseOwnerEdits(validForm({ submitterEmail: '', name: '  ', city: '' }));

        expect(result).toEqual({
            ok: false,
            fieldErrors: {
                name: OWNER_EDIT_ERRORS.required,
                city: OWNER_EDIT_ERRORS.required,
                submitterEmail: OWNER_EDIT_ERRORS.required,
            },
        });
    });

    it('polowa pary godzin i zly format HH:MM to bledy konkretnych pol', () => {
        const result = parseOwnerEdits(
            validForm({
                'hours.friday.open': '9:00',
                'hours.friday.close': '17:00',
            }),
        );

        expect(result).toEqual({
            ok: false,
            fieldErrors: { 'hours.friday.open': OWNER_EDIT_ERRORS.invalidTime },
        });

        const halfPair = parseOwnerEdits(validForm({ 'hours.monday.close': '' }));
        expect(halfPair).toEqual({
            ok: false,
            fieldErrors: { 'hours.monday.close': OWNER_EDIT_ERRORS.incompleteHours },
        });
    });

    it.each(['javascript:alert(1)', 'ftp://nowak.pl', 'nowak.pl'])(
        'webpage %s nie jest URL-em http(s)',
        webpage => {
            const result = parseOwnerEdits(validForm({ webpage }));

            expect(result).toEqual({
                ok: false,
                fieldErrors: { webpage: OWNER_EDIT_ERRORS.invalidUrl },
            });
        },
    );

    it('jezyk spoza dozwolonego zbioru i pusta lista jezykow sa odrzucane', () => {
        expect(parseOwnerEdits(validForm({ languages: ['pl', 'de'] }))).toEqual({
            ok: false,
            fieldErrors: { languages: OWNER_EDIT_ERRORS.invalidLanguage },
        });
        expect(parseOwnerEdits(validForm({ languages: [] }))).toEqual({
            ok: false,
            fieldErrors: { languages: OWNER_EDIT_ERRORS.languagesRequired },
        });
    });

    it('powtorzony kod jezyka trafia do wyniku raz', () => {
        const result = parseOwnerEdits(validForm({ languages: ['uk', 'uk', 'pl'] }));

        if (!result.ok) throw new Error(JSON.stringify(result.fieldErrors));
        expect(result.data.languages).toEqual(['uk', 'pl']);
    });

    it(`uwagi dluzsze niz ${NOTES_MAX_LENGTH} znakow sa odrzucane`, () => {
        const result = parseOwnerEdits(validForm({ notes: 'a'.repeat(NOTES_MAX_LENGTH + 1) }));

        expect(result).toEqual({ ok: false, fieldErrors: { notes: OWNER_EDIT_ERRORS.tooLong } });
    });

    it.each(TEXT_FIELDS)('plik zamiast tekstu w polu %s to blad pola, nie wyjatek', field => {
        const formData = validForm();
        formData.set(field, new File(['x'], 'x.txt'));

        const result = parseOwnerEdits(formData);

        expect(result).toEqual({
            ok: false,
            fieldErrors: { [field]: OWNER_EDIT_ERRORS.invalidValue },
        });
    });
});
