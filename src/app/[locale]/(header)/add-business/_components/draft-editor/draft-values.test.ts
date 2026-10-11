import { PREVIEW_FIXTURE } from '../business-card-preview/preview-fixture';
import {
    addressOf,
    initialValues,
    previewFromValues,
    sameAddress,
    stillUnconfirmed,
} from './draft-values';

describe('draft-values', () => {
    it('wartosci poczatkowe odwzorowuja szkic, puste pola jako pusty napis', () => {
        const values = initialValues({ ...PREVIEW_FIXTURE, phoneNumber: null, openingHours: null });

        expect(values.name).toBe('Kawiarnia Lwów');
        expect(values.phoneNumber).toBe('');
        expect(values.hours.monday).toEqual({ open: '', close: '' });
        expect(values.languages).toEqual(['pl', 'uk']);
    });

    it('podglad po edycji bierze pola wlasciciela, a kategorie i opisy ze szkicu', () => {
        const values = { ...initialValues(PREVIEW_FIXTURE), phoneNumber: '  ', name: 'Nowa nazwa' };

        const preview = previewFromValues(PREVIEW_FIXTURE, values);

        expect(preview.name).toBe('Nowa nazwa');
        expect(preview.phoneNumber).toBeNull();
        expect(preview.category).toBe(PREVIEW_FIXTURE.category);
        expect(preview.descriptions).toBe(PREVIEW_FIXTURE.descriptions);
    });

    it('dzien z niepelna para godzin nie trafia na karte', () => {
        const values = initialValues({ ...PREVIEW_FIXTURE, openingHours: null });
        values.hours.monday = { open: '09:00', close: '' };

        expect(previewFromValues(PREVIEW_FIXTURE, values).openingHours).toBeNull();

        values.hours.monday = { open: '09:00', close: '15:00' };
        expect(previewFromValues(PREVIEW_FIXTURE, values).openingHours).toEqual({
            monday: { open: '09:00', close: '15:00' },
        });
    });

    it('znacznik zostaje tylko przy polach wciaz pustych', () => {
        const preview = { ...PREVIEW_FIXTURE, email: null };

        expect(stillUnconfirmed(['phoneNumber', 'email'], preview)).toEqual(['email']);
    });

    it('adres porownywany bez wielkosci liter i spacji', () => {
        const geocoded = { street: 'ul. Długa 1', city: 'Gdańsk' };

        expect(sameAddress(addressOf({ street: ' UL. DŁUGA 1 ', city: 'gdańsk' }), geocoded)).toBe(
            true,
        );
        expect(sameAddress(addressOf({ street: 'ul. Długa 2', city: 'Gdańsk' }), geocoded)).toBe(
            false,
        );
    });
});
