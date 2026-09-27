import { foldForSearch } from './search-text';

describe('foldForSearch', () => {
    it('zamienia polskie znaki na litery bez znakow diakrytycznych', () => {
        expect(foldForSearch('zażółć gęślą jaźń')).toBe('zazolc gesla jazn');
    });

    it('zamienia ł na l, ktorego NFD nie rozklada', () => {
        expect(foldForSearch('Łódź')).toBe('lodz');
    });

    it('sprowadza tekst do malych liter', () => {
        expect(foldForSearch('KSIĘGOWA')).toBe('ksiegowa');
    });

    it('nie zmienia liter innych niz polskie znaki', () => {
        expect(foldForSearch('masas')).toBe('masas');
    });

    it('zostawia cyrylice czytelna do dopasowania', () => {
        expect(foldForSearch('Стоматолог')).toBe('стоматолог');
    });

    it('sklada й, ї i ё do liter bazowych — swiadoma decyzja, patrz komentarz funkcji', () => {
        expect(foldForSearch('Київ')).toBe(foldForSearch('Киів'));
        expect(foldForSearch('Йога')).toBe('иога');
        expect(foldForSearch('ёлка')).toBe('елка');
    });

    it('nie zmienia liter cyrylicy bez znakow laczacych', () => {
        expect(foldForSearch('ґанок іспит щ')).toBe('ґанок іспит щ');
    });
});
