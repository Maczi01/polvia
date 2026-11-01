import {
    InvalidManualPremiumDateError,
    isCalendarDate,
    isManualPremiumActive,
    manualPremiumEnd,
    manualPremiumLastDay,
} from './manual-premium';

describe('manualPremiumEnd — granica dnia w Europe/Warsaw', () => {
    it('zima (CET, +1): koniec 30 listopada to polnoc 1 grudnia czasu polskiego', () => {
        expect(manualPremiumEnd('2026-11-30').toISOString()).toBe('2026-11-30T23:00:00.000Z');
    });

    it('lato (CEST, +2): koniec 15 lipca to 22:00 UTC', () => {
        expect(manualPremiumEnd('2026-07-15').toISOString()).toBe('2026-07-15T22:00:00.000Z');
    });

    it('dzien przed zmiana czasu na letni: polnoc jeszcze w CET', () => {
        // Zmiana 29.03.2026 o 2:00 — polnoc 29 marca jest jeszcze w czasie zimowym.
        expect(manualPremiumEnd('2026-03-28').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    });

    it('dzien przed zmiana czasu na zimowy: polnoc jeszcze w CEST', () => {
        // Zmiana 25.10.2026 o 3:00 — polnoc 25 pazdziernika jest jeszcze w czasie letnim.
        expect(manualPremiumEnd('2026-10-24').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    });

    it('ostatni dzien roku przechodzi na nowy rok', () => {
        expect(manualPremiumEnd('2026-12-31').toISOString()).toBe('2026-12-31T23:00:00.000Z');
    });

    it('niepoprawna data rzuca typowany blad', () => {
        expect(() => manualPremiumEnd('2026-02-30')).toThrow(InvalidManualPremiumDateError);
        expect(() => manualPremiumEnd('30.11.2026')).toThrow(InvalidManualPremiumDateError);
    });
});

describe('manualPremiumLastDay', () => {
    it.each(['2026-11-30', '2026-07-15', '2026-03-28', '2026-10-24', '2026-12-31', '2028-02-29'])(
        'odwraca manualPremiumEnd dla %s',
        date => {
            expect(manualPremiumLastDay(manualPremiumEnd(date))).toBe(date);
        },
    );
});

describe('isCalendarDate', () => {
    it('akceptuje istniejace dni, takze 29 lutego roku przestepnego', () => {
        expect(isCalendarDate('2026-11-30')).toBe(true);
        expect(isCalendarDate('2028-02-29')).toBe(true);
    });

    it('odrzuca nieistniejace dni i inne formaty', () => {
        expect(isCalendarDate('2026-02-29')).toBe(false);
        expect(isCalendarDate('2026-13-01')).toBe(false);
        expect(isCalendarDate('2026-11-31')).toBe(false);
        expect(isCalendarDate('2026-1-5')).toBe(false);
        expect(isCalendarDate('2026-11-30T00:00:00Z')).toBe(false);
    });
});

describe('isManualPremiumActive — granica dnia', () => {
    const end = manualPremiumEnd('2026-11-30');

    it('aktywne w ostatniej sekundzie dnia czasu polskiego (23:59:59)', () => {
        expect(isManualPremiumActive(end, new Date('2026-11-30T22:59:59.999Z'))).toBe(true);
    });

    it('wygasa o polnocy czasu polskiego, choc w UTC to jeszcze 30 listopada', () => {
        expect(isManualPremiumActive(end, new Date('2026-11-30T23:00:00.000Z'))).toBe(false);
    });

    it('brak daty to brak premium recznego', () => {
        expect(isManualPremiumActive(null, new Date('2026-11-01T12:00:00Z'))).toBe(false);
    });
});
