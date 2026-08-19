import { coverageEnum, type Coverage } from '@/db/schema';

/**
 * Guard na wartosci `coverageEnum`.
 *
 * Od tych trzech literalow zaleza: parser URL (`online` w slocie lokalizacji),
 * walidacja Zod w Server Action dashboardu, filtr zasiegu i logika kubelkowania
 * wynikow. Przypadkowa zmiana nazwy wartosci rozjechalaby je wszystkie cicho,
 * bo kazde z tych miejsc czerpie z `coverageEnum.enumValues`.
 */
describe('coverageEnum', () => {
    it('ma dokladnie trzy wartosci w ustalonej kolejnosci', () => {
        expect(coverageEnum.enumValues).toEqual(['local', 'online', 'hybrid']);
    });

    it('domyslnym zasiegiem jest `local` — pierwsza wartosc', () => {
        expect(coverageEnum.enumValues[0]).toBe('local');
    });

    it('typ Coverage przyjmuje kazda wartosc enuma', () => {
        const wszystkie: Coverage[] = ['local', 'online', 'hybrid'];
        expect(wszystkie).toHaveLength(coverageEnum.enumValues.length);
    });

    it('typ Coverage odrzuca wartosc spoza enuma', () => {
        // @ts-expect-error 'zdalnie' nie jest wartoscia coverageEnum
        const niepoprawny: Coverage = 'zdalnie';
        expect(coverageEnum.enumValues).not.toContain(niepoprawny);
    });
});
