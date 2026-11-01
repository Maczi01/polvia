import { defaultLocale, locales, toLocale } from './config';

describe('toLocale', () => {
    it.each(locales)('zostawia obslugiwane locale %s bez zmian', locale => {
        expect(toLocale(locale)).toBe(locale);
    });

    it.each(['de', 'PL', '', 'pl-PL', null, undefined])(
        'wartosc spoza listy (%p) sprowadza do locale domyslnego',
        value => {
            expect(toLocale(value)).toBe(defaultLocale);
        },
    );
});
