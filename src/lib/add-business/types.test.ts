import { hasOpeningHours } from '@/lib/add-business/types';

describe('hasOpeningHours — domyslny stan checkboxa godzin', () => {
    it('szkic z choc jednym dniem ma godziny', () => {
        expect(hasOpeningHours({ monday: { open: '09:00', close: '17:00' } })).toBe(true);
    });

    it('null i pusty obiekt to brak godzin', () => {
        expect(hasOpeningHours(null)).toBe(false);
        expect(hasOpeningHours({})).toBe(false);
    });
});
