import { formatDisplayCount } from '@/lib/display-count';

describe('formatDisplayCount', () => {
    it('pokazuje male liczby dokladnie', () => {
        expect(formatDisplayCount(7)).toBe('7');
    });

    it('zaokragla setki w dol do dziesiatek', () => {
        expect(formatDisplayCount(137)).toBe('130+');
        expect(formatDisplayCount(10)).toBe('10+');
    });

    it('zaokragla tysiace w dol do setek', () => {
        expect(formatDisplayCount(2450)).toBe('2400+');
    });

    it('zwraca 0 dla pustej bazy i wartosci niepoprawnych', () => {
        expect(formatDisplayCount(0)).toBe('0');
        expect(formatDisplayCount(-3)).toBe('0');
        expect(formatDisplayCount(Number.NaN)).toBe('0');
    });
});
